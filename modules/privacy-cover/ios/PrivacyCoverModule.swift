import ExpoModulesCore
import UIKit

/// Covers every window with a solid color while the scene is inactive, so the App Switcher
/// snapshot (and anyone glancing at it) never shows balances. Added on top of the window, so it
/// also covers sheets and modals. docs/02 "Privacy screen".
public class PrivacyCoverModule: Module {
  private var covers: [ObjectIdentifier: UIView] = [:]
  private var observers: [NSObjectProtocol] = []
  private var color: UIColor = .black

  public func definition() -> ModuleDefinition {
    Name("PrivacyCover")

    OnCreate {
      self.observe()
    }

    OnDestroy {
      self.observers.forEach { NotificationCenter.default.removeObserver($0) }
      self.observers.removeAll()
    }

    /// The cover color, as "#RRGGBB" (the app passes its background token).
    Function("setColor") { (hex: String) in
      if let parsed = Self.color(from: hex) {
        self.color = parsed
      }
    }
  }

  private func observe() {
    let center = NotificationCenter.default
    observers.append(
      center.addObserver(forName: UIScene.willDeactivateNotification, object: nil, queue: .main) {
        [weak self] note in
        guard let scene = note.object as? UIWindowScene else { return }
        self?.cover(scene)
      })
    observers.append(
      center.addObserver(forName: UIScene.didActivateNotification, object: nil, queue: .main) {
        [weak self] note in
        guard let scene = note.object as? UIWindowScene else { return }
        self?.uncover(scene)
      })
  }

  private func cover(_ scene: UIWindowScene) {
    for window in scene.windows where covers[ObjectIdentifier(window)] == nil {
      let view = UIView(frame: window.bounds)
      view.backgroundColor = color
      view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
      view.accessibilityElementsHidden = true
      window.addSubview(view)
      covers[ObjectIdentifier(window)] = view
    }
  }

  private func uncover(_ scene: UIWindowScene) {
    for window in scene.windows {
      covers.removeValue(forKey: ObjectIdentifier(window))?.removeFromSuperview()
    }
  }

  private static func color(from hex: String) -> UIColor? {
    let digits = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
    guard digits.count == 6, let value = UInt32(digits, radix: 16) else { return nil }
    return UIColor(
      red: CGFloat((value >> 16) & 0xFF) / 255,
      green: CGFloat((value >> 8) & 0xFF) / 255,
      blue: CGFloat(value & 0xFF) / 255,
      alpha: 1)
  }
}
