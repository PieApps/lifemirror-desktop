cask "lifemirror-desktop" do
  arch arm: "aarch64", intel: "x64"

  version "1.5.0"
  sha256 arm:   "38ee4fd39275291ad2d14b20e808fbbb5197a60fac51a1a6aa3a85e8b865c1df",
         intel: "cd837940665d98727f4b74f82bf11db3a3f8db7f8924c97b10d98674ebdac2aa"

  url "https://github.com/PieApps/lifemirror-desktop/releases/download/v#{version}/lifemirror-desktop_#{version}_#{arch}.dmg"
  name "LifeMirror Desktop"
  desc "Privacy-first, local-focused productivity reflection utility"
  homepage "https://github.com/PieApps/lifemirror-desktop"

  livecheck do
    url :url
    strategy :github_latest
  end

  app "LifeMirror Desktop.app"

  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-dr", "com.apple.quarantine", "#{appdir}/LifeMirror Desktop.app"],
                   sudo: false
  end

  zap trash: [
    "~/Library/Application Support/com.lifemirror.desktop",
    "~/Library/Caches/com.lifemirror.desktop",
    "~/Library/WebKit/com.lifemirror.desktop",
  ]
end

