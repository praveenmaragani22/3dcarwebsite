import os
import numpy as np
from PIL import Image, ImageEnhance, ImageOps, ImageFilter

def make_car_lineup():
    os.makedirs('assets/cars', exist_ok=True)
    
    # Load base car image
    im = Image.open('carimage.png').convert('RGB')
    
    # Background thresholding: remove near-black background noise
    # Any pixel with max(R,G,B) < 16 is considered pure background #07080A
    arr = np.array(im, dtype=np.float32)
    # Brightness map
    brightness = np.maximum.reduce([arr[:,:,0], arr[:,:,1], arr[:,:,2]])
    
    # Smooth alpha mask
    mask = np.clip((brightness - 12.0) / 16.0, 0.0, 1.0)
    
    # Find bounding box of car where mask > 0.3
    y_indices, x_indices = np.where(mask > 0.3)
    min_x, max_x = np.min(x_indices), np.max(x_indices)
    min_y, max_y = np.min(y_indices), np.max(y_indices)
    
    car_w = max_x - min_x
    car_h = max_y - min_y
    
    # Crop car with its smooth alpha
    car_crop = arr[min_y:max_y+1, min_x:max_x+1]
    mask_crop = mask[min_y:max_y+1, min_x:max_x+1]
    
    # We want car to face RIGHT. In original, rear is on right (facing left).
    # Flip horizontally:
    car_crop = np.fliplr(car_crop)
    mask_crop = np.fliplr(mask_crop)
    
    # Now we compose onto 1600x900 canvas:
    # Target: car fills 70% of 1600 = 1120px wide
    # Wheels sitting on line at 72% of 900 = 648px
    target_canvas_w = 1600
    target_canvas_h = 900
    target_car_w = int(target_canvas_w * 0.70)
    scale = target_car_w / float(car_w)
    
    target_car_h = int(round(car_h * scale))
    
    # Let's resize car and mask to target size
    car_img = Image.fromarray(np.uint8(np.clip(car_crop, 0, 255)))
    mask_img = Image.fromarray(np.uint8(mask_crop * 255))
    
    car_resized = car_img.resize((target_car_w, target_car_h), Image.Resampling.LANCZOS)
    mask_resized = mask_img.resize((target_car_w, target_car_h), Image.Resampling.LANCZOS)
    
    car_arr = np.array(car_resized, dtype=np.float32)
    alpha_arr = np.array(mask_resized, dtype=np.float32) / 255.0
    alpha_arr = alpha_arr[:, :, np.newaxis]
    
    # Wheel line in target: bottom of car_crop is the wheels.
    # We place bottom of car at 72% of height = 648px.
    # (Or wheel contact patch at 648px)
    target_wheel_y = int(target_canvas_h * 0.72)
    paste_y = target_wheel_y - target_car_h
    paste_x = (target_canvas_w - target_car_w) // 2
    
    bg_color = np.array([7.0, 8.0, 10.0], dtype=np.float32) # #07080A
    
    def render_canvas(processed_car_arr):
        canvas = np.zeros((target_canvas_h, target_canvas_w, 3), dtype=np.float32)
        canvas[:, :] = bg_color
        
        # Sub-region
        sub = canvas[paste_y:paste_y+target_car_h, paste_x:paste_x+target_car_w]
        blended = processed_car_arr * alpha_arr + sub * (1.0 - alpha_arr)
        canvas[paste_y:paste_y+target_car_h, paste_x:paste_x+target_car_w] = blended
        
        # Ensure pure #07080A at floor and borders
        canvas[:5, :] = bg_color
        canvas[-5:, :] = bg_color
        canvas[:, :5] = bg_color
        canvas[:, -5:] = bg_color
        
        res = Image.fromarray(np.uint8(np.clip(canvas, 0, 255)))
        return res

    # 1. GT-E (Matte Graphite Grand Tourer Coupe)
    # Balanced sleek graphite finish
    gte_arr = car_arr.copy()
    gte_img = render_canvas(gte_arr)
    gte_img.save('assets/cars/gt-e.webp', 'WEBP', quality=85)
    print("Saved gt-e.webp")

    # 2. S (Four-door sport sedan, satin bone white)
    # Brighten body tones, tint towards bone #EDEAE4, preserve black rims and glass
    s_arr = car_arr.copy()
    lum = 0.299 * s_arr[:,:,0] + 0.587 * s_arr[:,:,1] + 0.114 * s_arr[:,:,2]
    body_mask = (lum > 30) & (lum < 220)
    s_arr[body_mask, 0] = np.clip(s_arr[body_mask, 0] * 1.8 + 30, 0, 237)
    s_arr[body_mask, 1] = np.clip(s_arr[body_mask, 1] * 1.8 + 28, 0, 234)
    s_arr[body_mask, 2] = np.clip(s_arr[body_mask, 2] * 1.7 + 24, 0, 228)
    s_img = render_canvas(s_arr)
    s_img.save('assets/cars/s.webp', 'WEBP', quality=85)
    print("Saved s.webp")

    # 3. X (SUV coupe roofline, midnight blue)
    # Deep midnight blue reflections #141B2D
    x_arr = car_arr.copy()
    x_arr[:,:,0] = np.clip(x_arr[:,:,0] * 0.7, 0, 255)
    x_arr[:,:,1] = np.clip(x_arr[:,:,1] * 0.85 + 10, 0, 255)
    x_arr[:,:,2] = np.clip(x_arr[:,:,2] * 1.4 + 30, 0, 255)
    x_img = render_canvas(x_arr)
    x_img.save('assets/cars/x.webp', 'WEBP', quality=85)
    print("Saved x.webp")

    # 4. R (Track coupe with fixed rear wing, satin black with thin red accents)
    # Deeper satin black body, enhanced glowing red rear light and red brake calipers
    r_arr = car_arr.copy()
    r_arr[:,:,0] = np.clip(r_arr[:,:,0] * 0.85, 0, 255)
    r_arr[:,:,1] = np.clip(r_arr[:,:,1] * 0.8, 0, 255)
    r_arr[:,:,2] = np.clip(r_arr[:,:,2] * 0.8, 0, 255)
    # Enhance reds
    red_mask = (car_arr[:,:,0] > car_arr[:,:,1] * 1.4)
    r_arr[red_mask, 0] = np.clip(r_arr[red_mask, 0] * 1.5 + 40, 0, 255)
    r_img = render_canvas(r_arr)
    r_img.save('assets/cars/r.webp', 'WEBP', quality=85)
    print("Saved r.webp")

    # 5. ONE (Concept hypercar, extremely low and long, liquid silver)
    # High contrast liquid silver chrome reflection
    one_arr = car_arr.copy()
    # High metallic sheen: curve adjustment
    one_arr = np.clip(one_arr * 1.25 + 10, 0, 255)
    # Slight cool xenon tint
    one_arr[:,:,2] = np.clip(one_arr[:,:,2] * 1.1 + 8, 0, 255)
    one_img = render_canvas(one_arr)
    one_img.save('assets/cars/one.webp', 'WEBP', quality=85)
    print("Saved one.webp")

    # Also save the first dismantle frame as fallback / reference placeholder
    dismantle_first = Image.open('flowclipframe/ezgif-frame-001.jpg')
    dismantle_first_resized = dismantle_first.resize((1600, 900), Image.Resampling.LANCZOS)
    dismantle_first_resized.save('assets/cars/placeholder.webp', 'WEBP', quality=85)
    print("Saved placeholder.webp")

if __name__ == '__main__':
    make_car_lineup()

