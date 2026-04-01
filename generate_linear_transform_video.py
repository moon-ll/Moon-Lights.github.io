import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.animation import FFMpegWriter
from matplotlib.patches import FancyBboxPatch
from PIL import Image, ImageDraw, ImageFont
import os
import subprocess
import imageio_ffmpeg

FFMPEG_PATH = imageio_ffmpeg.get_ffmpeg_exe()
plt.rcParams['animation.ffmpeg_path'] = FFMPEG_PATH

# Config
FPS = 24
RES_W, RES_H = 1280, 720
DPI = 96
FONT_PATH = r"C:\Windows\Fonts\msyh.ttc"
TMP_DIR = "tmp_video_parts"
os.makedirs(TMP_DIR, exist_ok=True)
os.makedirs("content", exist_ok=True)
OUTPUT = "content/linear-transform-video.mp4"

def save_pil_clip(frames, name):
    """Save PIL frames as MP4 using imageio."""
    import imageio.v3 as iio
    arr = np.array(frames)
    path = f"{TMP_DIR}/{name}.mp4"
    iio.imwrite(path, arr, fps=FPS, codec='libx264')
    return path

def title_card(text, subtext, duration):
    """Generate title card frames using PIL."""
    frames = []
    n = int(duration * FPS)
    try:
        font_big = ImageFont.truetype(FONT_PATH, 72)
        font_small = ImageFont.truetype(FONT_PATH, 28)
    except:
        font_big = ImageFont.load_default()
        font_small = ImageFont.load_default()
    
    for _ in range(n):
        img = Image.new('RGB', (RES_W, RES_H), '#0f172a')
        draw = ImageDraw.Draw(img)
        
        bbox = draw.textbbox((0, 0), text, font=font_big)
        tw, th = bbox[2]-bbox[0], bbox[3]-bbox[1]
        draw.text(((RES_W-tw)//2, (RES_H-th)//2 - 40), text, fill='#6366f1', font=font_big)
        
        if subtext:
            bbox2 = draw.textbbox((0, 0), subtext, font=font_small)
            tw2, th2 = bbox2[2]-bbox2[0], bbox2[3]-bbox2[1]
            draw.text(((RES_W-tw2)//2, (RES_H-th)//2 + 60), subtext, fill='#94a3b8', font=font_small)
        
        frames.append(np.array(img))
    return save_pil_clip(frames, name=text[:10])


def grid_clip(name, duration, matrix=None, title="", subtitle="", animate=False, 
              show_basis=True, highlight_diagonal=False, show_properties=None, show_matrix=True):
    """Generate a grid animation using matplotlib FuncAnimation + FFMpegWriter."""
    fig = plt.figure(figsize=(RES_W/DPI, RES_H/DPI), dpi=DPI, facecolor='#0f172a')
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_facecolor('#0f172a')
    ax.set_xlim(-6, 6)
    ax.set_ylim(-6, 6)
    ax.set_aspect('equal')
    ax.axis('off')
    
    # Set Chinese font
    plt.rcParams['font.sans-serif'] = ['Microsoft YaHei', 'SimHei']
    plt.rcParams['axes.unicode_minus'] = False
    
    M = np.eye(2) if matrix is None else matrix
    n_frames = int(duration * FPS)
    
    # Pre-calculate grid lines
    x_range = np.linspace(-5, 5, 11)
    y_range = np.linspace(-5, 5, 11)
    
    # Draw static background grid (will be updated each frame)
    h_lines = []
    v_lines = []
    for x in x_range:
        line, = ax.plot([], [], color='#334155', linewidth=1, alpha=0.6)
        h_lines.append(line)
    for y in y_range:
        line, = ax.plot([], [], color='#334155', linewidth=1, alpha=0.6)
        v_lines.append(line)
    
    # Highlight diagonal
    diag_line, = ax.plot([], [], color='#f59e0b', linewidth=2.5, alpha=0.9)
    
    # Basis vectors
    if show_basis:
        arrow1 = ax.annotate('', xy=(0, 0), xytext=(0, 0),
                            arrowprops=dict(arrowstyle='->', color='#ef4444', lw=2.5))
        arrow2 = ax.annotate('', xy=(0, 0), xytext=(0, 0),
                            arrowprops=dict(arrowstyle='->', color='#22c55e', lw=2.5))
        label1 = ax.text(0, 0, 'i', color='#ef4444', fontsize=14, fontweight='bold')
        label2 = ax.text(0, 0, 'j', color='#22c55e', fontsize=14, fontweight='bold')
    
    # Unit square
    square_fill, = ax.fill([], [], color='#6366f1', alpha=0.15)
    square_line, = ax.plot([], [], color='#6366f1', linewidth=2, alpha=0.8)
    
    # Axes
    ax.axhline(0, color='#475569', linewidth=1, alpha=0.4)
    ax.axvline(0, color='#475569', linewidth=1, alpha=0.4)
    
    # Titles
    title_text = ax.text(0.5, 0.96, title, transform=ax.transAxes, color='#f1f5f9',
                         fontsize=20, ha='center', va='top', fontweight='bold')
    sub_text = ax.text(0.5, 0.91, subtitle, transform=ax.transAxes, color='#94a3b8',
                       fontsize=12, ha='center', va='top')
    
    # Matrix text box
    if show_matrix and M is not None:
        mat_str = f"M = [[{M[0,0]:.1f}, {M[0,1]:.1f}],\n     [{M[1,0]:.1f}, {M[1,1]:.1f}]]"
        mat_box = ax.text(0.02, 0.98, mat_str, transform=ax.transAxes, color='#f1f5f9',
                          fontsize=14, ha='left', va='top', family='monospace',
                          bbox=dict(boxstyle='round', facecolor='#1e293b', edgecolor='#334155', alpha=0.9))
    else:
        mat_box = None
    
    # Properties box
    prop_box = None
    if show_properties:
        prop_str = "\n".join([f"- {p}" for p in show_properties])
        prop_box = ax.text(0.98, 0.12, prop_str, transform=ax.transAxes, color='#22c55e',
                           fontsize=12, ha='right', va='bottom',
                           bbox=dict(boxstyle='round', facecolor='#1e293b', edgecolor='#334155', alpha=0.9))
    
    def init():
        return h_lines + v_lines + [diag_line, square_line]
    
    def update(frame):
        t = frame / (n_frames - 1) if n_frames > 1 else 1.0
        if animate:
            t = t * t * (3 - 2 * t)  # smooth ease
        interp = np.eye(2) * (1 - t) + M * t
        
        # Update grid
        for i, x in enumerate(x_range):
            pts = np.array([[x, y] for y in y_range]) @ interp.T
            h_lines[i].set_data(pts[:, 0], pts[:, 1])
        for i, y in enumerate(y_range):
            pts = np.array([[x, y] for x in x_range]) @ interp.T
            v_lines[i].set_data(pts[:, 0], pts[:, 1])
        
        # Update diagonal
        if highlight_diagonal:
            diag_pts = np.array([[-4, -4], [4, 4]]) @ interp.T
            diag_line.set_data(diag_pts[:, 0], diag_pts[:, 1])
        
        # Update square
        sq = np.array([[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]) @ interp.T
        square_line.set_data(sq[:, 0], sq[:, 1])
        square_fill.set_xy(sq)
        
        # Update basis vectors
        if show_basis:
            e1 = np.array([1, 0]) @ interp.T
            e2 = np.array([0, 1]) @ interp.T
            arrow1.xy = e1
            arrow2.xy = e2
            label1.set_position((e1[0] + 0.2, e1[1] + 0.2))
            label2.set_position((e2[0] + 0.2, e2[1] + 0.2))
        
        # Update properties
        if show_properties and prop_box:
            n_props = min(len(show_properties), max(1, int(t * len(show_properties) + 0.5)))
            prop_str = "\n".join([f"- {p}" for p in show_properties[:n_props]])
            prop_box.set_text(prop_str)
        
        return h_lines + v_lines + [diag_line, square_line]
    
    path = f"{TMP_DIR}/{name}.mp4"
    writer = FFMpegWriter(fps=FPS, metadata=dict(artist='MOONLIGHT'), bitrate=4000)
    
    with writer.saving(fig, path, DPI):
        for i in range(n_frames):
            update(i)
            writer.grab_frame()
    
    plt.close(fig)
    return path


def multi_demo_clip():
    """Show rotation, scaling, shear side by side."""
    fig = plt.figure(figsize=(RES_W/DPI, RES_H/DPI), dpi=DPI, facecolor='#0f172a')
    plt.rcParams['font.sans-serif'] = ['Microsoft YaHei', 'SimHei']
    plt.rcParams['axes.unicode_minus'] = False
    
    demos = [
        ("旋转 Rotation", np.array([[0, -1], [1, 0]])),
        ("缩放 Scaling", np.array([[2, 0], [0, 0.5]])),
        ("剪切 Shear", np.array([[1, 1], [0, 1]]))
    ]
    
    axes = []
    all_lines = []
    for idx, (title, M) in enumerate(demos):
        ax = fig.add_axes([0.05 + idx*0.32, 0.15, 0.28, 0.7])
        ax.set_facecolor('#0f172a')
        ax.set_xlim(-4, 4)
        ax.set_ylim(-4, 4)
        ax.set_aspect('equal')
        ax.axis('off')
        ax.set_title(title, color='#f1f5f9', fontsize=16, fontweight='bold', pad=10)
        axes.append(ax)
        
        x_range = np.linspace(-3, 3, 7)
        y_range = np.linspace(-3, 3, 7)
        lines = []
        for x in x_range:
            line, = ax.plot([], [], color='#334155', linewidth=0.8, alpha=0.5)
            lines.append(('h', x, y_range, line))
        for y in y_range:
            line, = ax.plot([], [], color='#334155', linewidth=0.8, alpha=0.5)
            lines.append(('v', y, x_range, line))
        
        sq_fill, = ax.fill([], [], color='#6366f1', alpha=0.2)
        sq_line, = ax.plot([], [], color='#6366f1', linewidth=1.5, alpha=0.8)
        lines.append(('sq', None, None, sq_line, sq_fill))
        
        ax.axhline(0, color='#475569', linewidth=0.8, alpha=0.3)
        ax.axvline(0, color='#475569', linewidth=0.8, alpha=0.3)
        all_lines.append((lines, M))
    
    fig.suptitle("线性变换的三种基本形式", color='#f1f5f9', fontsize=24, fontweight='bold', y=0.95)
    
    n_frames = int(3 * FPS)
    
    def update(frame):
        t = frame / (n_frames - 1) if n_frames > 1 else 1.0
        t = t * t * (3 - 2 * t)
        for (lines, M), ax in zip(all_lines, axes):
            interp = np.eye(2) * (1 - t) + M * t
            for item in lines:
                if item[0] == 'h':
                    _, x, y_range, line = item
                    pts = np.array([[x, y] for y in y_range]) @ interp.T
                    line.set_data(pts[:, 0], pts[:, 1])
                elif item[0] == 'v':
                    _, y, x_range, line = item
                    pts = np.array([[x, y] for x in x_range]) @ interp.T
                    line.set_data(pts[:, 0], pts[:, 1])
                elif item[0] == 'sq':
                    _, _, _, line, fill = item
                    sq = np.array([[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]) @ interp.T
                    line.set_data(sq[:, 0], sq[:, 1])
                    fill.set_xy(sq)
    
    path = f"{TMP_DIR}/demos.mp4"
    writer = FFMpegWriter(fps=FPS, metadata=dict(artist='MOONLIGHT'), bitrate=4000)
    with writer.saving(fig, path, DPI):
        for i in range(n_frames):
            update(i)
            writer.grab_frame()
    
    plt.close(fig)
    return path


def concat_videos(parts, output):
    """Concatenate MP4 parts using ffmpeg."""
    list_file = f"{TMP_DIR}/concat_list.txt"
    with open(list_file, 'w', encoding='utf-8') as f:
        for p in parts:
            # Use absolute paths to avoid relative path resolution issues
            abs_path = os.path.abspath(p).replace('\\', '/')
            f.write(f"file '{abs_path}'\n")
    
    cmd = [
        FFMPEG_PATH, '-y', '-f', 'concat', '-safe', '0',
        '-i', list_file, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', str(FPS), output
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print("FFMPEG STDERR:", result.stderr)
        raise subprocess.CalledProcessError(result.returncode, cmd)
    print(f"Saved to {output}")


# Main transformation matrix
M = np.array([[2, 1], [0.5, 1.5]])

print("Generating video parts...")
parts = []

# 1. Title
parts.append(title_card("线性变换", "Linear Transformation", 2))
print("  Title done")

# 2. Original grid
parts.append(grid_clip("orig", 2, matrix=np.eye(2), title="标准坐标系",
                       subtitle="基向量 i 和 j 构成单位正方形"))
print("  Original grid done")

# 3. Animation
parts.append(grid_clip("anim", 5, matrix=M, title="应用变换矩阵",
                       subtitle="网格被拉伸和旋转，但直线仍然是直线", animate=True))
print("  Animation done")

# 4. Result explanation
parts.append(grid_clip("result", 2, matrix=M, title="变换后的坐标系",
                       subtitle="矩阵的每一列，就是变换后的基向量"))
print("  Result done")

# 5. Properties
parts.append(grid_clip("props", 3, matrix=M, title="线性变换的核心性质",
                       subtitle="", highlight_diagonal=True,
                       show_properties=["原点保持不动", "直线仍是直线", "平行线保持平行"]))
print("  Properties done")

# 6. Demos
parts.append(multi_demo_clip())
print("  Demos done")

# 7. Matrix essence
parts.append(grid_clip("essence", 2, matrix=M, title="矩阵的本质",
                       subtitle="[a b; c d] 的每一列，描述了基向量变换后的位置"))
print("  Essence done")

# 8. Ending
parts.append(title_card("线性变换", "一切复杂变换，都是基向量的线性组合", 2))
print("  Ending done")

print("Concatenating...")
concat_videos(parts, OUTPUT)

# Cleanup
import shutil
shutil.rmtree(TMP_DIR)
print("Done!")
