interface BrowserElectronAPI {
  isAvailable: boolean;
  startActivityTracking: (userId: string, token: string) => Promise<{ success: boolean; tracking: boolean }>;
  stopActivityTracking: () => Promise<{ success: boolean; tracking: false }>;
  getActivityStatus: () => Promise<{
    tracking: boolean;
    userId: string | null;
    idleTime: number;
    isIdle: boolean;
  }>;
  onActivityStatus: (callback: (data: any) => void) => () => void;
  showNotification: (title: string, body: string, icon?: string) => Promise<{ success: boolean }>;
  captureScreenshot: (consent: boolean) => Promise<{ 
    success: boolean; 
    filepath?: string; 
    filename?: string; 
    timestamp?: string; 
    size?: number; 
    error?: string;
    data?: string;
  }>;
}

class BrowserElectronService {
  private static instance: BrowserElectronService;
  private readonly ELECTRON_PORT = 8766;
  private readonly ELECTRON_URL = `http://localhost:${this.ELECTRON_PORT}`;
  private isAvailable: boolean = false;
  private eventSource: EventSource | null = null;
  private activityCallbacks: Set<(data: any) => void> = new Set();

  private constructor() {
    this.checkAvailability();
  }

  static getInstance(): BrowserElectronService {
    if (!BrowserElectronService.instance) {
      BrowserElectronService.instance = new BrowserElectronService();
    }
    return BrowserElectronService.instance;
  }

  private async checkAvailability(): Promise<void> {
    try {
      console.log('🔍 Checking Electron availability at:', `${this.ELECTRON_URL}/activity-status`);
      const response = await fetch(`${this.ELECTRON_URL}/activity-status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      this.isAvailable = response.ok;
      console.log('🔍 Response status:', response.status, response.statusText);
      console.log('🔍 Response headers:', Object.fromEntries(response.headers.entries()));
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 Response data:', data);
      }
      console.log('✅ Electron service available:', this.isAvailable);
    } catch (error) {
      this.isAvailable = false;
      console.log('❌ Electron service not available:', error instanceof Error ? error.message : String(error));
      console.log('❌ Error details:', error);
    }
  }

  get isServiceAvailable(): boolean {
    return this.isAvailable;
  }

  async startActivityTracking(userId: string, token: string): Promise<{ success: boolean; tracking: boolean }> {
    if (!this.isAvailable) {
      console.warn('Electron service not available');
      return { success: false, tracking: false };
    }

    try {
      const response = await fetch(`${this.ELECTRON_URL}/start-tracking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, token }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Activity tracking started:', result);
      
      // Start listening for activity events
      this.startActivityEvents();
      
      return result;
    } catch (error) {
      console.error('Failed to start activity tracking:', error instanceof Error ? error.message : String(error));
      return { success: false, tracking: false };
    }
  }

  async stopActivityTracking(): Promise<{ success: boolean; tracking: false }> {
    if (!this.isAvailable) {
      return { success: false, tracking: false };
    }

    try {
      const response = await fetch(`${this.ELECTRON_URL}/stop-tracking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Activity tracking stopped:', result);
      
      // Stop listening for activity events
      this.stopActivityEvents();
      
      return result;
    } catch (error) {
      console.error('Failed to stop activity tracking:', error instanceof Error ? error.message : String(error));
      return { success: false, tracking: false };
    }
  }

  async getActivityStatus(): Promise<{
    tracking: boolean;
    userId: string | null;
    idleTime: number;
    isIdle: boolean;
  } | null> {
    if (!this.isAvailable) {
      return null;
    }

    try {
      const response = await fetch(`${this.ELECTRON_URL}/activity-status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get activity status:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  onActivityStatus(callback: (data: any) => void): () => void {
    console.log('🔌 Adding activity status callback');
    this.activityCallbacks.add(callback);
    
    // If this is the first callback, start the event source
    if (this.activityCallbacks.size === 1) {
      this.startActivityEvents();
    }

    // Return unsubscribe function
    return () => {
      console.log('🔌 Removing activity status callback');
      this.activityCallbacks.delete(callback);
      
      // If no more callbacks, stop the event source
      if (this.activityCallbacks.size === 0) {
        this.stopActivityEvents();
      }
    };
  }

  private startActivityEvents(): void {
    if (this.eventSource || !this.isAvailable) {
      return;
    }

    try {
      this.eventSource = new EventSource(`${this.ELECTRON_URL}/activity-events`);
      
      this.eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('📨 Activity event from Electron:', data);
            // Notify all callbacks
            console.log(`🔔 Notifying ${this.activityCallbacks.size} activity callbacks`);
            this.activityCallbacks.forEach((callback) => {
              try {
                console.log(`🎯 Calling activity callback`);
                callback(data);
              } catch (error) {
                console.error(`❌ Error in activity callback:`, error instanceof Error ? error.message : String(error));
              }
            });
          } catch (error) {
            console.error('❌ Error parsing activity event:', error instanceof Error ? error.message : String(error));
          }
        };

      this.eventSource.onerror = (error) => {
          console.error('EventSource error:', error);
          this.stopActivityEvents();
        };

      this.eventSource.onopen = () => {
        console.log('Connected to Electron activity events');
      };

    } catch (error) {
      console.error('Failed to create EventSource:', error instanceof Error ? error.message : String(error));
    }
  }

  private stopActivityEvents(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      console.log('Disconnected from Electron activity events');
    }
  }

  // Method to retry checking availability
  async retryConnection(): Promise<boolean> {
    await this.checkAvailability();
    return this.isAvailable;
  }

  // Force immediate availability check
  async forceCheckAvailability(): Promise<boolean> {
    console.log('🔄 Forcing immediate availability check...');
    await this.checkAvailability();
    console.log('🔄 Force check result:', this.isAvailable);
    return this.isAvailable;
  }

  // Public method to check Electron service availability
  async isElectronAvailable(): Promise<boolean> {
    await this.checkAvailability();
    return this.isAvailable;
  }

  async showNotification(title: string, body: string, icon?: string): Promise<{ success: boolean }> {
    if (!this.isAvailable) {
      console.warn('Electron service not available, falling back to browser notification');
      // Fallback to browser notification if Electron service is not available
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon });
        return { success: true };
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          new Notification(title, { body, icon });
          return { success: true };
        }
      }
      return { success: false };
    }

    try {
      const response = await fetch(`${this.ELECTRON_URL}/show-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, body, icon }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('System notification sent:', result);
      return result;
    } catch (error) {
      console.error('Failed to send system notification:', error instanceof Error ? error.message : String(error));
      
      // Fallback to browser notification
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon });
        return { success: true };
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          new Notification(title, { body, icon });
          return { success: true };
        }
      }
      
      return { success: false };
    }
  }

  async captureScreenshot(consent: boolean): Promise<{ 
    success: boolean; 
    filepath?: string; 
    filename?: string; 
    timestamp?: string; 
    size?: number; 
    error?: string;
    data?: string;
  }> {
    if (!this.isAvailable) {
      console.warn('Electron service not available for screenshot capture');
      return { success: false, error: 'Electron service not available' };
    }

    // Require explicit consent
    if (!consent) {
      return { success: false, error: 'Screenshot capture requires explicit consent' };
    }

    try {
      const response = await fetch(`${this.ELECTRON_URL}/capture-screenshot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ consent: true }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Screenshot captured:', result);
      return result;
    } catch (error) {
      console.error('Failed to capture screenshot:', error instanceof Error ? error.message : String(error));
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

export const browserElectronService = BrowserElectronService.getInstance();