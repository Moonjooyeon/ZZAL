import SwiftUI
import WebKit
import AuthenticationServices
import GoogleMobileAds
import UserMessagingPlatform

private let website = URL(string: "https://zzal.ashwoodfriends.com/")!
private let productionBannerID = "ca-app-pub-6168104800079733/8964806517"
private let testBannerID = "ca-app-pub-3940256099942544/2435281174"

@main
struct ZZALApp: App {
    var body: some Scene {
        WindowGroup {
            WebsiteView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .ignoresSafeArea()
        }
    }
}

private struct WebsiteView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> WebsiteController { WebsiteController() }
    func updateUIViewController(_ controller: WebsiteController, context: Context) {}
}

private final class WebsiteController: UIViewController, WKNavigationDelegate,
    WKUIDelegate, ASWebAuthenticationPresentationContextProviding, BannerViewDelegate {
    private var webView: WKWebView!
    private let adContainer = UIView()
    private var adHeight: NSLayoutConstraint!
    private var bannerView: BannerView?
    private var lastBannerWidth: CGFloat = 0
    private var adsStarted = false
    private var authSession: ASWebAuthenticationSession?

    override func loadView() {
        view = UIView(frame: UIScreen.main.bounds)
        view.backgroundColor = .white
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.translatesAutoresizingMaskIntoConstraints = false
        adContainer.translatesAutoresizingMaskIntoConstraints = false
        adContainer.backgroundColor = .white
        view.addSubview(webView)
        view.addSubview(adContainer)
        adHeight = adContainer.heightAnchor.constraint(equalToConstant: 0)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: adContainer.topAnchor),
            adContainer.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            adContainer.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            adContainer.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            adHeight,
        ])
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        webView.load(URLRequest(url: website))
        requestConsentAndStartAds()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        let width = view.safeAreaLayoutGuide.layoutFrame.width
        if adsStarted, width > 0, abs(width - lastBannerWidth) > 1 {
            loadBanner(width: width)
        }
    }

    private func requestConsentAndStartAds() {
        let parameters = RequestParameters()
        ConsentInformation.shared.requestConsentInfoUpdate(with: parameters) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor in
                try? await ConsentForm.loadAndPresentIfRequired(from: self)
                if ConsentInformation.shared.canRequestAds { self.startAds() }
            }
        }
    }

    private func startAds() {
        guard !adsStarted else { return }
        adsStarted = true
        MobileAds.shared.start()
        view.setNeedsLayout()
        view.layoutIfNeeded()
        loadBanner(width: view.safeAreaLayoutGuide.layoutFrame.width)
    }

    private func loadBanner(width: CGFloat) {
        guard width > 0 else { return }
        lastBannerWidth = width
        bannerView?.removeFromSuperview()
        let size = largeAnchoredAdaptiveBanner(width: width)
        let banner = BannerView(adSize: size)
#if DEBUG
        banner.adUnitID = testBannerID
#else
        banner.adUnitID = productionBannerID
#endif
        banner.rootViewController = self
        banner.delegate = self
        banner.translatesAutoresizingMaskIntoConstraints = false
        adContainer.addSubview(banner)
        NSLayoutConstraint.activate([
            banner.centerXAnchor.constraint(equalTo: adContainer.centerXAnchor),
            banner.centerYAnchor.constraint(equalTo: adContainer.centerYAnchor),
        ])
        bannerView = banner
        banner.load(Request())
    }

    func bannerViewDidReceiveAd(_ bannerView: BannerView) {
        adHeight.constant = bannerView.adSize.size.height
        UIView.animate(withDuration: 0.2) { self.view.layoutIfNeeded() }
    }

    func bannerView(_ bannerView: BannerView, didFailToReceiveAdWithError error: Error) {
        adHeight.constant = 0
        view.layoutIfNeeded()
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        let isWebsite = url.scheme == "https" && url.host == website.host
        if isWebsite && (url.path == "/api/auth/google" || url.path == "/api/auth/apple") {
            decisionHandler(.cancel)
            startAuthentication(url)
        } else if !isWebsite && (url.scheme == "http" || url.scheme == "https") {
            decisionHandler(.cancel)
            UIApplication.shared.open(url)
        } else {
            decisionHandler(.allow)
        }
    }

    private func startAuthentication(_ url: URL) {
        guard var parts = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return }
        parts.queryItems = (parts.queryItems ?? []) + [URLQueryItem(name: "mobile", value: "ios")]
        guard let loginURL = parts.url else { return }
        let session = ASWebAuthenticationSession(url: loginURL, callbackURLScheme: "izzal") {
            [weak self] callback, error in
            DispatchQueue.main.async {
                self?.authSession = nil
                if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin { return }
                guard let callback,
                      callback.scheme == "izzal", callback.host == "auth",
                      let ticket = URLComponents(url: callback, resolvingAgainstBaseURL: false)?
                        .queryItems?.first(where: { $0.name == "ticket" })?.value else {
                    self?.showError("로그인을 완료하지 못했어요. 다시 시도해 주세요.")
                    return
                }
                self?.finishAuthentication(ticket)
            }
        }
        session.presentationContextProvider = self
        authSession = session
        if !session.start() { showError("로그인 화면을 열지 못했어요.") }
    }

    private func finishAuthentication(_ ticket: String) {
        guard let encoded = try? JSONEncoder().encode(ticket),
              let quoted = String(data: encoded, encoding: .utf8) else { return }
        let script = """
        fetch('/api/auth/mobile/consume', {
          method: 'POST', credentials: 'same-origin',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ticket: \(quoted)})
        }).then(r => { if (!r.ok) throw Error('login'); location.replace('/'); })
          .catch(() => { window.alert('로그인 결과를 적용하지 못했어요. 다시 시도해 주세요.'); });
        """
        webView.evaluateJavaScript(script) { [weak self] _, error in
            if error != nil { self?.showError("로그인 결과를 적용하지 못했어요.") }
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        view.window ?? UIApplication.shared.connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.keyWindow }.first ?? UIWindow()
    }

    private func showError(_ message: String) {
        let alert = UIAlertController(title: "로그인 오류", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "확인", style: .default))
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url { UIApplication.shared.open(url) }
        return nil
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: "이짤이이짤", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "확인", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }
}
