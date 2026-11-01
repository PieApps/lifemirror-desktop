cask "lifemirror-desktop" do
  arch arm: "aarch64", intel: "x64"

  version "1.3.4"
  sha256 arm:   "a5c2fa5925eb09042745dddd294bf3145e8373b0cf0da45e4fa876f02ae61433",
         intel: "76d004f6105193fee91cba066ba49bfa7ed1f45a31e274e0be83a65f6f44a822"

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

