const invoke = () =>
  Promise.reject(new Error('Tauri not available in test environment'));

module.exports = {
  invoke,
  default: {
    invoke,
  },
};
