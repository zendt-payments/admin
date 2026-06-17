import Capacitor

class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        guard let scrollView = webView?.scrollView else {
            return
        }
        scrollView.minimumZoomScale = 1.0
        scrollView.maximumZoomScale = 1.0
        scrollView.bouncesZoom = false
        scrollView.pinchGestureRecognizer?.isEnabled = false
    }
}
