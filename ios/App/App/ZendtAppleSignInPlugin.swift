import Foundation
import Capacitor
import AuthenticationServices
import UIKit
import CryptoKit

/// Sign in with Apple — web OAuth (Services ID) on Simulator; native sheet on device.
@objc(ZendtAppleSignInPlugin)
public class ZendtAppleSignInPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ZendtAppleSignInPlugin"
    public let jsName = "ZendtAppleSignIn"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise),
    ]

    private static let appCallbackScheme = "com.zendt.app"
    private static let bundleClientId = "com.zendt.app"

    private var pendingCallbackId: String?
    private weak var anchorWindow: UIWindow?
    private var webAuthSession: ASWebAuthenticationSession?

    @objc func authorize(_ call: CAPPluginCall) {
        let useWeb = call.getBool("useWeb", false)
        #if targetEnvironment(simulator)
        authorizeWeb(call)
        #else
        if useWeb {
            authorizeWeb(call)
        } else {
            authorizeNative(call)
        }
        #endif
    }

    private func authorizeNative(_ call: CAPPluginCall) {
        let appleIDProvider = ASAuthorizationAppleIDProvider()
        let request = appleIDProvider.createRequest()
        request.requestedScopes = Self.parseScopes(call.getString("scopes"))
        request.state = call.getString("state")
        if let nonce = call.getString("nonce"), !nonce.isEmpty {
            request.nonce = Self.sha256(nonce)
        }

        pendingCallbackId = call.callbackId
        bridge?.saveCall(call)

        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            guard let saved = self.savedPendingCall() else { return }
            guard let anchor = Self.presentationAnchor(for: self.bridge) else {
                saved.reject(
                    "No UI window for Sign in with Apple. Quit and reopen the app, then try again."
                )
                self.bridge?.releaseCall(saved)
                self.pendingCallbackId = nil
                return
            }

            self.anchorWindow = anchor
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }

    /// Web OAuth: client_id must be the Services ID (e.g. com.zendt.app.signin), not the app bundle ID.
    private func authorizeWeb(_ call: CAPPluginCall) {
        guard var clientId = call.getString("clientId"), !clientId.isEmpty,
              let redirectURI = call.getString("redirectURI"), !redirectURI.isEmpty,
              URL(string: redirectURI) != nil
        else {
            call.reject("Apple web sign-in requires clientId (Services ID) and redirectURI.")
            return
        }

        if clientId == Self.bundleClientId {
            call.reject(
                "Apple web sign-in requires Services ID com.zendt.app.signin as clientId, not app bundle ID \(Self.bundleClientId)."
            )
            return
        }

        let state = call.getString("state") ?? "zendt-social"
        let rawNonce = call.getString("nonce") ?? UUID().uuidString
        let hashedNonce = Self.sha256(rawNonce)
        let scope = (call.getString("scopes") ?? "name email")
            .replacingOccurrences(of: ",", with: " ")
            .trimmingCharacters(in: .whitespaces)

        var components = URLComponents(string: "https://appleid.apple.com/auth/authorize")!
        components.queryItems = [
            URLQueryItem(name: "client_id", value: clientId),
            URLQueryItem(name: "redirect_uri", value: redirectURI),
            URLQueryItem(name: "response_type", value: "code id_token"),
            URLQueryItem(name: "response_mode", value: "form_post"),
            URLQueryItem(name: "scope", value: scope),
            URLQueryItem(name: "state", value: state),
            URLQueryItem(name: "nonce", value: hashedNonce),
        ]

        guard let authURL = components.url else {
            call.reject("Could not build Apple authorize URL.")
            return
        }

        pendingCallbackId = call.callbackId
        bridge?.saveCall(call)

        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            guard let saved = self.savedPendingCall() else { return }
            guard let anchor = Self.presentationAnchor(for: self.bridge) else {
                saved.reject("No UI window for Apple web sign-in.")
                self.bridge?.releaseCall(saved)
                self.pendingCallbackId = nil
                return
            }
            self.anchorWindow = anchor

            self.webAuthSession?.cancel()
            self.webAuthSession = nil

            let completion: (URL?, Error?) -> Void = { [weak self] callbackURL, error in
                guard let self else { return }
                self.webAuthSession = nil
                guard let call = self.savedPendingCall() else { return }
                defer {
                    self.bridge?.releaseCall(call)
                    self.pendingCallbackId = nil
                    self.anchorWindow = nil
                }

                if let error = error as NSError? {
                    if error.domain == ASWebAuthenticationSessionErrorDomain,
                       error.code == ASWebAuthenticationSessionError.canceledLogin.rawValue {
                        call.reject(
                            "Apple web sign-in was cancelled (code 1001). If the sheet never appeared, check Services ID, return URL, and that backend/ngrok is running."
                        )
                        return
                    }
                    call.reject("Apple web sign-in failed: \(error.localizedDescription)")
                    return
                }

                guard let callbackURL else {
                    call.reject("Apple web sign-in ended without a callback URL.")
                    return
                }
                if let oauthError = Self.oauthErrorFromCallbackURL(callbackURL) {
                    call.reject(
                        "Apple returned \(oauthError). On Services ID \(clientId): add domain \(Self.domainFromRedirect(redirectURI)) and Return URL \(redirectURI)."
                    )
                    return
                }
                guard let tokens = Self.tokensFromCallbackURL(callbackURL) else {
                    call.reject(
                        "Apple web sign-in did not return a token. Keep backend/ngrok running at \(redirectURI) and sign into Simulator → Apple Account."
                    )
                    return
                }

                call.resolve([
                    "response": [
                        "user": NSNull(),
                        "email": NSNull(),
                        "givenName": NSNull(),
                        "familyName": NSNull(),
                        "identityToken": tokens.idToken,
                        "authorizationCode": tokens.code,
                    ],
                ])
            }

            let session = ASWebAuthenticationSession(
                url: authURL,
                callbackURLScheme: Self.appCallbackScheme,
                completionHandler: completion
            )

            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.webAuthSession = session

            if !session.start() {
                call.reject("Could not start Apple web sign-in. Close other sign-in windows and try again.")
                self.bridge?.releaseCall(saved)
                self.pendingCallbackId = nil
                self.webAuthSession = nil
            }
        }
    }

    private func savedPendingCall() -> CAPPluginCall? {
        guard let id = pendingCallbackId else { return nil }
        return bridge?.savedCall(withID: id)
    }

    private static func sha256(_ value: String) -> String {
        let digest = SHA256.hash(data: Data(value.utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    private static func parseScopes(_ scopesStr: String?) -> [ASAuthorization.Scope]? {
        guard let scopesStr, !scopesStr.isEmpty else { return nil }
        var scopes: [ASAuthorization.Scope] = []
        if scopesStr.contains("name") { scopes.append(.fullName) }
        if scopesStr.contains("email") { scopes.append(.email) }
        return scopes.isEmpty ? nil : scopes
    }

    private static func domainFromRedirect(_ redirectURI: String) -> String {
        URL(string: redirectURI)?.host ?? redirectURI
    }

    private static func oauthErrorFromCallbackURL(_ url: URL) -> String? {
        var params: [String: String] = [:]
        if let fragment = url.fragment, !fragment.isEmpty {
            params = parseQueryString(fragment)
        }
        if let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems {
            for item in items where item.value != nil {
                params[item.name] = item.value
            }
        }
        return params["error"]?.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func tokensFromCallbackURL(_ url: URL) -> (idToken: String, code: String)? {
        var params: [String: String] = [:]
        if let fragment = url.fragment, !fragment.isEmpty {
            params = parseQueryString(fragment)
        }
        if params.isEmpty, let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems {
            for item in items where item.value != nil {
                params[item.name] = item.value
            }
        }
        guard let idToken = params["id_token"], !idToken.isEmpty else { return nil }
        return (idToken, params["code"] ?? "")
    }

    private static func parseQueryString(_ value: String) -> [String: String] {
        var out: [String: String] = [:]
        for pair in value.split(separator: "&") {
            let parts = pair.split(separator: "=", maxSplits: 1).map(String.init)
            guard parts.count == 2 else { continue }
            let key = parts[0].removingPercentEncoding ?? parts[0]
            let val = parts[1].removingPercentEncoding ?? parts[1]
            out[key] = val
        }
        return out
    }

    private static func presentationAnchor(for bridge: CAPBridgeProtocol?) -> UIWindow? {
        if let window = bridge?.viewController?.viewIfLoaded?.window {
            return window
        }
        if let window = bridge?.viewController?.view.window {
            return window
        }
        if let delegate = UIApplication.shared.delegate as? AppDelegate, let window = delegate.window {
            return window
        }
        for scene in UIApplication.shared.connectedScenes {
            guard let windowScene = scene as? UIWindowScene else { continue }
            if let key = windowScene.keyWindow { return key }
            if let first = windowScene.windows.first { return first }
        }
        return nil
    }
}

extension ZendtAppleSignInPlugin: ASAuthorizationControllerDelegate {
    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        guard let call = savedPendingCall() else { return }
        defer {
            bridge?.releaseCall(call)
            pendingCallbackId = nil
            anchorWindow = nil
        }

        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            call.reject("Apple returned an unexpected credential type.")
            return
        }

        let identityToken = credential.identityToken.flatMap { String(data: $0, encoding: .utf8) } ?? ""
        let authorizationCode = credential.authorizationCode.flatMap { String(data: $0, encoding: .utf8) } ?? ""

        call.resolve([
            "response": [
                "user": credential.user,
                "email": credential.email as Any,
                "givenName": credential.fullName?.givenName as Any,
                "familyName": credential.fullName?.familyName as Any,
                "identityToken": identityToken,
                "authorizationCode": authorizationCode,
            ],
        ])
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        guard let call = savedPendingCall() else { return }
        defer {
            bridge?.releaseCall(call)
            pendingCallbackId = nil
            anchorWindow = nil
        }
        let ns = error as NSError
        call.reject("ASAuthorizationError \(ns.code): \(ns.localizedDescription)")
    }
}

extension ZendtAppleSignInPlugin: ASAuthorizationControllerPresentationContextProviding {
    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        anchorWindow ?? Self.presentationAnchor(for: bridge) ?? ASPresentationAnchor()
    }
}

extension ZendtAppleSignInPlugin: ASWebAuthenticationPresentationContextProviding {
    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        anchorWindow ?? Self.presentationAnchor(for: bridge) ?? ASPresentationAnchor()
    }
}
