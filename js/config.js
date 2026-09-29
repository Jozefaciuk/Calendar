/**
 * Moduł konfiguracji uwierzytelniania w chmurze
 */
const AppConfig = {
  getBinId() {
    return localStorage.getItem('cfg_bin_id') || '';
  },
  
  getApiKey() {
    return localStorage.getItem('cfg_api_key') || '';
  },

  setCredentials(binId, apiKey) {
    localStorage.setItem('cfg_bin_id', binId);
    localStorage.setItem('cfg_api_key', apiKey);
  },

  clearCredentials() {
    localStorage.removeItem('cfg_bin_id');
    localStorage.removeItem('cfg_api_key');
  },

  getApiUrl() {
    const id = this.getBinId();
    return id ? `https://api.jsonbin.io/v3/b/${id}` : '';
  },

  hasCredentials() {
    return Boolean(this.getBinId() && this.getApiKey());
  }
};