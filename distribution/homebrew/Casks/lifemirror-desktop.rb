cask "lifemirror-desktop" do
  arch arm: "aarch64", intel: "x64"

  version "1.3.3"
  sha256 arm:   "REPLACE_WITH_AARCH64_SHA256",
         intel: "REPLACE_WITH_X64_SHA256"

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

