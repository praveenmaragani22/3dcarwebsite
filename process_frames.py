import os
import re
import time
from concurrent.futures import ProcessPoolExecutor
from PIL import Image, ImageChops, ImageStat

def natural_sort_key(s):
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s)]

def diff_frames(p1, p2):
    im1 = Image.open(p1).convert('RGB')
    im2 = Image.open(p2).convert('RGB')
    diff = ImageChops.difference(im1, im2)
    stat = ImageStat.Stat(diff)
    return sum(stat.mean) / 3.0

def process_single_frame(args):
    src_path, dst_desktop, dst_mobile = args
    try:
        im = Image.open(src_path).convert('RGB')
        
        # Desktop version (1600px wide)
        w, h = im.size
        desktop_h = int(round(1600.0 * h / w))
        im_desktop = im.resize((1600, desktop_h), Image.Resampling.LANCZOS)
        im_desktop.save(dst_desktop, 'WEBP', quality=78, method=4)
        
        # Mobile version (960px wide)
        mobile_h = int(round(960.0 * h / w))
        im_mobile = im.resize((960, mobile_h), Image.Resampling.LANCZOS)
        im_mobile.save(dst_mobile, 'WEBP', quality=72, method=4)
        return True
    except Exception as e:
        print(f"Error processing {src_path}: {e}")
        return False

def get_dir_size_mb(path):
    total = 0
    for root, dirs, files in os.walk(path):
        for f in files:
            fp = os.path.join(root, f)
            total += os.path.getsize(fp)
    return total / (1024 * 1024)

def main():
    start_time = time.time()
    
    # 1. Create directories
    dirs = [
        'assets/frames/hero',
        'assets/frames/hero-mobile',
        'assets/frames/dismantle',
        'assets/frames/dismantle-mobile',
        'assets/cars'
    ]
    for d in dirs:
        os.makedirs(d, exist_ok=True)

    # 2. Gather hero clips
    c1 = [os.path.join('clip1frame', f) for f in sorted(os.listdir('clip1frame'), key=natural_sort_key)]
    c2 = [os.path.join('clip2frames', f) for f in sorted(os.listdir('clip2frames'), key=natural_sort_key)]
    c3 = [os.path.join('clip3frames', f) for f in sorted(os.listdir('clip3frames'), key=natural_sort_key)]

    hero_src = list(c1)
    
    # Check join c1 -> c2
    if diff_frames(c1[-1], c2[0]) < 0.5:
        print("Skipping c2[0] because it is nearly identical to c1[-1]")
        hero_src.extend(c2[1:])
    else:
        hero_src.extend(c2)
        
    # Check join c2 -> c3
    if diff_frames(c2[-1], c3[0]) < 0.5:
        print("Skipping c3[0] because it is nearly identical to c2[-1]")
        hero_src.extend(c3[1:])
    else:
        hero_src.extend(c3)

    print(f"Total hero source frames: {len(hero_src)}")

    # 3. Gather dismantle
    dismantle_src = [os.path.join('flowclipframe', f) for f in sorted(os.listdir('flowclipframe'), key=natural_sort_key)]
    print(f"Total dismantle source frames: {len(dismantle_src)}")

    # Build tasks
    tasks = []
    for i, src in enumerate(hero_src, 1):
        num_str = f"{i:04d}"
        dst_desk = os.path.join('assets/frames/hero', f"frame_{num_str}.webp")
        dst_mob = os.path.join('assets/frames/hero-mobile', f"frame_{num_str}.webp")
        tasks.append((src, dst_desk, dst_mob))

    for i, src in enumerate(dismantle_src, 1):
        num_str = f"{i:04d}"
        dst_desk = os.path.join('assets/frames/dismantle', f"frame_{num_str}.webp")
        dst_mob = os.path.join('assets/frames/dismantle-mobile', f"frame_{num_str}.webp")
        tasks.append((src, dst_desk, dst_mob))

    print(f"Executing {len(tasks)} frame export tasks across CPU cores...")
    with ProcessPoolExecutor() as executor:
        results = list(executor.map(process_single_frame, tasks))

    success_count = sum(1 for r in results if r)
    elapsed = time.time() - start_time
    print(f"Completed {success_count}/{len(tasks)} frames in {elapsed:.2f} seconds.")

    # Frame counts & sizes
    for folder in ['assets/frames/hero', 'assets/frames/hero-mobile', 'assets/frames/dismantle', 'assets/frames/dismantle-mobile']:
        count = len(os.listdir(folder))
        size_mb = get_dir_size_mb(folder)
        print(f"Folder: {folder} | Frames: {count} | Total Size: {size_mb:.2f} MB")

if __name__ == '__main__':
    main()

