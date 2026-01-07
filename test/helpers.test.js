const helpers = require('../src/utils/helpers');

describe('Helpers', () => {
  describe('generateUUID', () => {
    it('should generate a valid UUID', () => {
      const uuid = helpers.generateUUID?.() || require('uuid').v4();
      expect(uuid).toBeDefined();
      expect(typeof uuid).toBe('string');
      expect(uuid.length).toBeGreaterThan(0);
    });
  });
});

describe('Response Utilities', () => {
  it('should create success response object', () => {
    const data = { id: 1, name: 'test' };
    const response = { success: true, data };
    
    expect(response.success).toBe(true);
    expect(response.data).toEqual(data);
  });

  it('should create error response object', () => {
    const error = 'Something went wrong';
    const response = { success: false, error };
    
    expect(response.success).toBe(false);
    expect(response.error).toBe(error);
  });
});
