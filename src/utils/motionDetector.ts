import { MotionPoint } from '../types';

export interface MotionDetectionResult {
  hasMotion: boolean;
  points: MotionPoint[];
  leftMotionEnergy: number;
  rightMotionEnergy: number;
  centerMotionEnergy: number;
  totalMotionPixels: number;
  detectedFace: boolean;
  zoneEnergies: { [key: string]: number }; // 'left-0', 'left-1', 'right-0', 'right-1', 'right-2'
}

export class MotionDetector {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private prevFrameData: Uint8Array | null = null;
  private width = 160;
  private height = 120;
  private diffCanvas: HTMLCanvasElement | null = null;
  private diffCtx: CanvasRenderingContext2D | null = null;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  public setDebugCanvas(canvas: HTMLCanvasElement | null) {
    this.diffCanvas = canvas;
    if (canvas) {
      this.diffCtx = canvas.getContext('2d');
    } else {
      this.diffCtx = null;
    }
  }

  /**
   * Fast RGB to YCbCr skin tone detector
   * Normalized values for standard webcam video
   */
  private isSkinTone(r: number, g: number, b: number): boolean {
    // Basic RGB rule for human skin under common illumination
    if (r <= 60 || g <= 40 || b <= 20) return false;
    if (r <= g || r <= b) return false;
    if (Math.abs(r - g) < 12) return false;

    // YCbCr color space conversion
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

    return cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173;
  }

  /**
   * Process video frame and detect motion hotspots
   */
  public processFrame(
    video: HTMLVideoElement,
    sensitivity: number, // 1 - 10
    isMirrored: boolean
  ): MotionDetectionResult {
    const emptyResult: MotionDetectionResult = {
      hasMotion: false,
      points: [],
      leftMotionEnergy: 0,
      rightMotionEnergy: 0,
      centerMotionEnergy: 0,
      totalMotionPixels: 0,
      detectedFace: false,
      zoneEnergies: {},
    };

    if (!this.ctx || video.readyState < 2) {
      return emptyResult;
    }

    // Draw current frame scaled down
    this.ctx.drawImage(video, 0, 0, this.width, this.height);
    const frame = this.ctx.getImageData(0, 0, this.width, this.height);
    const data = frame.data;
    const numPixels = this.width * this.height;

    // Convert to grayscale & record skin mask
    const currentGray = new Uint8Array(numPixels);
    const isSkinMap = new Uint8Array(numPixels);

    let skinPixelSumX = 0;
    let skinPixelSumY = 0;
    let skinPixelCount = 0;

    for (let i = 0; i < numPixels; i++) {
      const idx = i * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Fast luminance formula
      currentGray[i] = (r * 299 + g * 587 + b * 114) >> 10;

      if (this.isSkinTone(r, g, b)) {
        isSkinMap[i] = 1;
        const px = i % this.width;
        const py = Math.floor(i / this.width);

        // Keep track of central face/body skin cluster
        const normX = px / this.width;
        const normY = py / this.height;
        if (normX >= 0.25 && normX <= 0.75 && normY <= 0.65) {
          skinPixelSumX += normX;
          skinPixelSumY += normY;
          skinPixelCount++;
        }
      }
    }

    // Estimate face center dynamically if skin pixels cluster in upper center
    let estimatedFaceCenterX = 0.5;
    let estimatedFaceCenterY = 0.35;
    let hasEstimatedFace = false;

    if (skinPixelCount > 100) {
      estimatedFaceCenterX = skinPixelSumX / skinPixelCount;
      estimatedFaceCenterY = skinPixelSumY / skinPixelCount;
      hasEstimatedFace = true;
    }

    if (!this.prevFrameData) {
      this.prevFrameData = currentGray;
      return emptyResult;
    }

    // Diff threshold inversely proportional to sensitivity
    const diffThreshold = Math.max(12, 34 - sensitivity * 2.2);
    let leftMotionCount = 0;
    let rightMotionCount = 0;
    const points: MotionPoint[] = [];

    // Define plant zones in normalized coordinates
    // Left: 2 plants: top (left-0), bottom (left-1)
    // Right: 3 plants: top (right-0), mid (right-1), bot (right-2)
    const zoneCounts: { [key: string]: number } = {
      'left-0': 0,
      'left-1': 0,
      'right-0': 0,
      'right-1': 0,
      'right-2': 0,
    };

    let centerMotionCount = 0;
    let motionPixelCount = 0;
    let sumX = 0;
    let sumY = 0;

    // Prepare diff canvas image if debug mode is active
    let diffImageData: ImageData | null = null;
    if (this.diffCtx && this.diffCanvas) {
      diffImageData = this.diffCtx.createImageData(this.width, this.height);
    }

    for (let y = 0; y < this.height; y++) {
      const normY = y / this.height;
      for (let x = 0; x < this.width; x++) {
        const idx = y * this.width + x;
        const diff = Math.abs(currentGray[idx] - this.prevFrameData[idx]);
        const isMotion = diff > diffThreshold;

        // Compute normalized coordinates (0 to 1)
        let normX = x / this.width;
        if (isMirrored) {
          normX = 1 - normX;
        }

        // Face & Head/Upper Torso Exclusion:
        // 1. Static bounding box: normX 0.28 ~ 0.72, normY 0.04 ~ 0.65
        const isInStaticFaceBox = normX >= 0.28 && normX <= 0.72 && normY >= 0.04 && normY <= 0.65;

        // 2. Dynamic face proximity: within radius of tracked face center
        const dx = normX - (isMirrored ? 1 - estimatedFaceCenterX : estimatedFaceCenterX);
        const dy = normY - estimatedFaceCenterY;
        const distToFaceCenter = Math.sqrt(dx * dx + dy * dy);
        const isNearFaceCenter = hasEstimatedFace && distToFaceCenter < 0.24;

        const isFaceOrBodyCore = isInStaticFaceBox || isNearFaceCenter;

        // Hand Gesture Detection Zone:
        // Must be in the side interaction channels where the standing user waves hands
        // Left hand channel: normX < 0.35
        // Right hand channel: normX > 0.65
        // (Ensures the user standing in the middle cannot trigger plants with face/body shifts)
        const isLeftHandChannel = normX < 0.35 && normY >= 0.12 && normY <= 0.88;
        const isRightHandChannel = normX > 0.65 && normY >= 0.12 && normY <= 0.88;
        const isValidHandRegion = isLeftHandChannel || isRightHandChannel;

        const isSkin = isSkinMap[idx] === 1;

        if (diffImageData) {
          const dIdx = idx * 4;
          if (isFaceOrBodyCore) {
            // Visual indicator: face/head/body core is strictly ignored
            if (isMotion) {
              diffImageData.data[dIdx] = 239; // Red: Face/body movement actively ignored
              diffImageData.data[dIdx + 1] = 68;
              diffImageData.data[dIdx + 2] = 68;
              diffImageData.data[dIdx + 3] = 220;
            } else {
              diffImageData.data[dIdx] = 50;
              diffImageData.data[dIdx + 1] = 20;
              diffImageData.data[dIdx + 2] = 20;
              diffImageData.data[dIdx + 3] = 80;
            }
          } else if (isValidHandRegion && isMotion) {
            // Hand motion in side zones
            if (isSkin) {
              // High confidence hand motion (skin color match)
              diffImageData.data[dIdx] = 52; // Vibrant emerald green
              diffImageData.data[dIdx + 1] = 211;
              diffImageData.data[dIdx + 2] = 153;
              diffImageData.data[dIdx + 3] = 255;
            } else {
              // Regular hand motion (sleeves / clothing)
              diffImageData.data[dIdx] = 59; // Cyan / Blue-green
              diffImageData.data[dIdx + 1] = 130;
              diffImageData.data[dIdx + 2] = 246;
              diffImageData.data[dIdx + 3] = 220;
            }
          } else if (isMotion) {
            diffImageData.data[dIdx] = 100;
            diffImageData.data[dIdx + 1] = 116;
            diffImageData.data[dIdx + 2] = 139;
            diffImageData.data[dIdx + 3] = 120;
          } else {
            diffImageData.data[dIdx] = 15;
            diffImageData.data[dIdx + 1] = 23;
            diffImageData.data[dIdx + 2] = 42;
            diffImageData.data[dIdx + 3] = 90;
          }
        }

        if (isMotion) {
          motionPixelCount++;

          if (isFaceOrBodyCore) {
            // Face or torso moving (talking, turning head, nodding) -> strictly ignore
            centerMotionCount += 3;
            continue;
          }

          // Only hand channels register toward pushing plants
          if (!isValidHandRegion) {
            centerMotionCount++;
            continue;
          }

          sumX += normX;
          sumY += normY;

          // Bonus weight for skin-colored hand motions
          const weight = isSkin ? 1.6 : 1.0;

          // Left border: 2 plants
          if (isLeftHandChannel) {
            leftMotionCount += weight;
            if (normY < 0.48) {
              zoneCounts['left-0'] += weight;
            } else {
              zoneCounts['left-1'] += weight;
            }
          } else if (isRightHandChannel) {
            // Right border: 3 plants
            rightMotionCount += weight;
            if (normY < 0.38) {
              zoneCounts['right-0'] += weight;
            } else if (normY < 0.68) {
              zoneCounts['right-1'] += weight;
            } else {
              zoneCounts['right-2'] += weight;
            }
          }
        }
      }
    }

    // Render debug canvas if active
    if (this.diffCtx && this.diffCanvas && diffImageData) {
      this.diffCtx.putImageData(diffImageData, 0, 0);
    }

    // Save current frame for next iteration
    this.prevFrameData = currentGray;

    const minMotionThreshold = Math.max(35, 120 - sensitivity * 9);

    if (motionPixelCount > minMotionThreshold) {
      const avgX = sumX / Math.max(1, leftMotionCount + rightMotionCount);
      const avgY = sumY / Math.max(1, leftMotionCount + rightMotionCount);
      points.push({
        x: avgX,
        y: avgY,
        intensity: Math.min(1, motionPixelCount / (this.width * this.height * 0.15)),
        timestamp: Date.now(),
      });
    }

    return {
      hasMotion: (leftMotionCount + rightMotionCount) > 15 || motionPixelCount > minMotionThreshold,
      points,
      leftMotionEnergy: leftMotionCount,
      rightMotionEnergy: rightMotionCount,
      centerMotionEnergy: centerMotionCount,
      totalMotionPixels: motionPixelCount,
      detectedFace: hasEstimatedFace,
      zoneEnergies: zoneCounts,
    };
  }

  public reset() {
    this.prevFrameData = null;
  }
}

