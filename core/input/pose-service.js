// core/input/pose-service.js

class PoseService {
    constructor() {
        this.listeners = new Set();
        this.isRunning = false;

        // Infrastructure
        this.videoElement = null;
        this.stream = null;
        this.detector = null; // This will hold the AI model
        this.animationFrameId = null;
    }

    subscribe(callback) {
        this.listeners.add(callback);
        // Auto-start if this is the first listener
        if (!this.isRunning && this.listeners.size === 1) {
            this.startCamera();
        }
        return () => {
            this.listeners.delete(callback);
            // Auto-stop if no listeners remain
            if (this.isRunning && this.listeners.size === 0) {
                this.stopCamera();
            }
        };
    }

    async startCamera() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log("📷 Starting MoveNet...");

        // 1. SETUP VIDEO
        if (!this.videoElement) {
            this.videoElement = document.createElement('video');
            this.videoElement.width = 640;
            this.videoElement.height = 480;
            // Important for iOS/Safari to play inline without fullscreen
            this.videoElement.playsInline = true;
        }

        try {
            // 2. GET WEBCAM STREAM
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: 640,
                    height: 480,
                    facingMode: 'user' // 'environment' for back camera
                }
            });
            this.videoElement.srcObject = this.stream;

            // Wait for video to actually load data so the AI doesn't crash
            await new Promise((resolve) => {
                this.videoElement.onloadedmetadata = () => {
                    this.videoElement.play();
                    resolve();
                };
            });

            // 3. LOAD MOVENET MODEL
            // Check if global library exists (loaded via CDN in index.html)
            if (window.poseDetection) {
                console.log("🧠 Loading AI Model...");
                const model = poseDetection.SupportedModels.MoveNet;
                // Use MultiPose Lightning (Fast, supports up to 6 people)
                const detectorConfig = {
                    modelType: poseDetection.movenet.modelType.MULTIPOSE_LIGHTNING,
                    enableSmoothing: true,
                    minPoseScore: 0.25
                };
                this.detector = await poseDetection.createDetector(model, detectorConfig);
                console.log("✅ AI Model Ready!");
            } else {
                console.error("❌ TensorFlow/PoseDetection libraries not found! Check index.html");
            }

            // 4. START LOOP
            this.loop();

        } catch (err) {
            console.error("Error initializing camera/AI:", err);
            this.isRunning = false;
        }
    }

    stopCamera() {
        console.log("🛑 Stopping MoveNet...");
        this.isRunning = false;

        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);

        // Turn off webcam light
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        // Clean up detector memory (optional but good practice)
        if (this.detector) {
            this.detector.dispose();
            this.detector = null;
        }
    }

    async loop() {
        if (!this.isRunning) return;

        // Run AI Detection
        if (this.detector && this.videoElement.readyState === 4) { // 4 means HAVE_ENOUGH_DATA
            try {
                // Returns an array of poses (one for each person detected)
                const poses = await this.detector.estimatePoses(this.videoElement);

                // Broadcast the raw array to all game adapters
                // Adapter needs to handle: poses[0].keypoints
                if (poses && poses.length > 0) {
                    this.listeners.forEach(cb => cb(poses));
                }
            } catch (err) {
                console.warn("AI Estimation Error:", err);
            }
        }

        this.animationFrameId = requestAnimationFrame(() => this.loop());
    }
}

export const poseService = new PoseService();
