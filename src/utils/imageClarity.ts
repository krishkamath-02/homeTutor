/**
 * Utility to check image clarity (resolution, brightness, and basic sharpness)
 * before sending to AI.
 */

export interface ClarityResult {
    isClear: boolean;
    score: number; // 0-100
    reason?: string;
}

export const checkImageClarity = async (file: File): Promise<ClarityResult> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                // 1. Resolution Check
                const minDim = Math.min(img.width, img.height);
                if (minDim < 600) {
                    return resolve({
                        isClear: false,
                        score: 30,
                        reason: 'Low Resolution: Image needs to be at least 600px wide.'
                    });
                }

                // 2. Brightness/Sharpness Check via Canvas
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return resolve({ isClear: true, score: 100 });

                // Small sample for performance
                canvas.width = 100;
                canvas.height = 100;
                ctx.drawImage(img, 0, 0, 100, 100);

                const imageData = ctx.getImageData(0, 0, 100, 100);
                const data = imageData.data;

                let brightness = 0;
                for (let i = 0; i < data.length; i += 4) {
                    brightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
                }
                const avgBrightness = brightness / (data.length / 4);

                // Brightness thresholds (0-255)
                if (avgBrightness < 40) {
                    return resolve({
                        isClear: false,
                        score: 40,
                        reason: 'Too Dark: Please take the photo in better lighting.'
                    });
                }
                if (avgBrightness > 245) {
                    return resolve({
                        isClear: false,
                        score: 40,
                        reason: 'Overexposed: Too much glare/light.'
                    });
                }

                // Basic Edge Density Check (for blurriness)
                // We compare adjacent pixels to see if there's sharp contrast
                let edgeSum = 0;
                for (let y = 0; y < 99; y++) {
                    for (let x = 0; x < 99; x++) {
                        const idx = (y * 100 + x) * 4;
                        const nextIdx = (y * 100 + (x + 1)) * 4;
                        const val = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
                        const nextVal = (data[nextIdx] + data[nextIdx + 1] + data[nextIdx + 2]) / 3;
                        edgeSum += Math.abs(val - nextVal);
                    }
                }

                const avgEdge = edgeSum / 10000;

                if (avgEdge < 2) {
                    return resolve({
                        isClear: false,
                        score: 45,
                        reason: 'Blurry: The photo is too out of focus.'
                    });
                }

                resolve({
                    isClear: true,
                    score: Math.min(100, Math.round(avgEdge * 10 + 50))
                });
            };
            img.onerror = () => resolve({ isClear: true, score: 100 });
            img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
    });
};
