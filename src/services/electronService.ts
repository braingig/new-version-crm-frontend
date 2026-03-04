interface ElectronAPI {
  saveToken: (token: string) => void;
  getToken: () => string | undefined;
  clearToken: () => void;
  startActivityTracking: (userId: string) => Promise<{ success: boolean; tracking: boolean }>;
  stopActivityTracking: () => Promise<{ success: boolean; tracking: boolean }>;
  getActivityStatus: () => Promise<{
    tracking: boolean;
    userId: string | null;
    idleTime: number;
    isIdle: boolean;
  }>;
  setAuthToken: (token: string) => Promise<{ success: boolean }>;
  onActivityStatus: (callback: (data: any) => void) => void;
  removeAllListeners: (channel: string) => void;
  captureScreen: (consent: boolean) => Promise<{
    success: boolean;
    filepath?: string;
    filename?: string;
    timestamp?: string;
    size?: number;
    data?: string;
    error?: string;
  }>;
  platform: string;
}

class ElectronService {
  private isElectron: boolean;
  private electronAPI: ElectronAPI | null = null;
  private activityCallback: ((data: any) => void) | null = null;

  constructor() {
    this.isElectron = typeof window !== 'undefined' && !!(window as any).electron;
    this.electronAPI = this.isElectron ? (window as any).electron : null;
  }

  get isRunningInElectron(): boolean {
    return this.isElectron;
  }

  get platform(): string {
    return this.electronAPI?.platform || 'web';
  }

  async saveToken(token: string): Promise<void> {
    if (this.electronAPI) {
      this.electronAPI.saveToken(token);
      await this.electronAPI.setAuthToken(token);
    }
  }

  getToken(): string | undefined {
    return this.electronAPI?.getToken();
  }

  clearToken(): void {
    if (this.electronAPI) {
      this.electronAPI.clearToken();
    }
  }

  async startActivityTracking(userId: string): Promise<boolean> {
    if (!this.electronAPI) return false;
    
    try {
      const result = await this.electronAPI.startActivityTracking(userId);
      return result.success && result.tracking;
    } catch (error) {
      console.error('Failed to start activity tracking:', error);
      return false;
    }
  }

  async stopActivityTracking(): Promise<boolean> {
    if (!this.electronAPI) return false;
    
    try {
      const result = await this.electronAPI.stopActivityTracking();
      return result.success && !result.tracking;
    } catch (error) {
      console.error('Failed to stop activity tracking:', error);
      return false;
    }
  }

  async getActivityStatus(): Promise<{
    tracking: boolean;
    userId: string | null;
    idleTime: number;
    isIdle: boolean;
  } | null> {
    if (!this.electronAPI) return null;
    
    try {
      return await this.electronAPI.getActivityStatus();
    } catch (error) {
      console.error('Failed to get activity status:', error);
      return null;
    }
  }

  onActivityStatus(callback: (data: any) => void): void {
    if (!this.electronAPI) return;
    
    // Remove existing listener if any
    if (this.activityCallback) {
      this.electronAPI.removeAllListeners('activity-status');
    }
    
    this.activityCallback = callback;
    this.electronAPI.onActivityStatus(callback);
  }

  removeActivityStatusListener(): void {
    if (this.electronAPI && this.activityCallback) {
      this.electronAPI.removeAllListeners('activity-status');
      this.activityCallback = null;
    }
  }

  async captureScreen(consent: boolean = true): Promise<{
    success: boolean;
    filepath?: string;
    filename?: string;
    timestamp?: string;
    size?: number;
    data?: string;
    error?: string;
  } | null> {
    if (!this.electronAPI) return null;
    
    try {
      return await this.electronAPI.captureScreen(consent);
    } catch (error) {
      console.error('Failed to capture screen:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const electronService = new ElectronService();