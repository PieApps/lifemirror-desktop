import os
import sys

def main():
    try:
        from PIL import Image, ImageOps, ImageEnhance
    except ImportError:
        try:
            import subprocess
            subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
            from PIL import Image, ImageOps, ImageEnhance
        except Exception as e:
            print(f"Failed to install Pillow: {e}. Falling back to copying default icon.")
            fallback()
            return

    try:
        icons_dir = os.path.dirname(os.path.abspath(__file__))
        src_icon = os.path.join(icons_dir, "icons", "32x32.png")
        
        if not os.path.exists(src_icon):
            print(f"Source icon not found at {src_icon}")
            fallback()
            return
            
        print(f"Loading base icon from {src_icon}...")
        img = Image.open(src_icon).convert("RGBA")
        
        # 1. Generate paused/gray version
        r, g, b, a = img.split()
        gray_rgb = ImageOps.grayscale(Image.merge("RGB", (r, g, b)))
        enhancer = ImageEnhance.Brightness(gray_rgb)
        faded_gray = enhancer.enhance(0.6)
        
        paused_img = Image.merge("RGBA", (faded_gray, faded_gray, faded_gray, a))
        paused_path = os.path.join(icons_dir, "icons", "32x32_paused.png")
        paused_img.save(paused_path, "PNG")
        print(f"Saved paused icon to {paused_path}")
        
        # 2. Generate incognito/amber version
        amber_tint = Image.new("RGBA", img.size, (245, 158, 11, 255))
        tinted_img = Image.blend(img, amber_tint, 0.4)
        _, _, _, original_a = img.split()
        tr, tg, tb, _ = tinted_img.split()
        incog_img = Image.merge("RGBA", (tr, tg, tb, original_a))
        
        incog_path = os.path.join(icons_dir, "icons", "32x32_incognito.png")
        incog_img.save(incog_path, "PNG")
        print(f"Saved incognito icon to {incog_path}")
        
    except Exception as e:
        print(f"Error generating icons: {e}. Falling back to copying default icon.")
        fallback()

def fallback():
    icons_dir = os.path.dirname(os.path.abspath(__file__))
    src_icon = os.path.join(icons_dir, "icons", "32x32.png")
    if os.path.exists(src_icon):
        for name in ["32x32_paused.png", "32x32_incognito.png"]:
            dest = os.path.join(icons_dir, "icons", name)
            if not os.path.exists(dest):
                try:
                    import shutil
                    shutil.copy(src_icon, dest)
                    print(f"Copied fallback icon to {dest}")
                except Exception as e:
                    print(f"Failed to copy fallback icon: {e}")

if __name__ == "__main__":
    main()
