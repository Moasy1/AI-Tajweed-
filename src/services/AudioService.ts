export type AccuracyThreshold = 'idle' | 'weak' | 'close' | 'good' | 'excellent';

export class TajweedAudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private animationFrameId: number | null = null;
  
  public readonly AI_MODEL_VERSION = "Gemini-2.5-Flash-Tajweed";

  async startRecording(onAnalysisUpdate: (accuracy: AccuracyThreshold, volume: number) => void) {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.microphone = this.audioContext.createMediaStreamSource(this.stream);
      
      this.microphone.connect(this.analyser);
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      
      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const analyze = () => {
        if (!this.analyser) return;
        
        this.analyser.getByteFrequencyData(dataArray);
        
        // Calculate root mean square (RMS) volume
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / bufferLength);
        const normalizedVolume = Math.min(100, Math.round((rms / 128) * 100));
        
        let accuracy: AccuracyThreshold = 'idle';
        if (normalizedVolume > 15) {
          accuracy = 'good';
        }
        
        onAnalysisUpdate(accuracy, normalizedVolume);
        this.animationFrameId = requestAnimationFrame(analyze);
      };
      
      analyze();
      
    } catch (error) {
      console.error("Error accessing microphone:", error);
      throw error;
    }
  }

  stopRecording() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }
}
