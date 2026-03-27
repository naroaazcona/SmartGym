const bcrypt = require('bcryptjs');
const User = require('../User');  

jest.mock('../../database/db', () => ({
  query: jest.fn()
}));

describe('User.verifyPassword', () => {
  test('devuelve true con contraseña correcta', async () => {
    const hash = await bcrypt.hash('miPassword123', 10);
    const resultado = await User.verifyPassword('miPassword123', hash);
    expect(resultado).toBe(true);
  });

  test('devuelve false con contraseña incorrecta', async () => {
    const hash = await bcrypt.hash('miPassword123', 10);
    const resultado = await User.verifyPassword('otraPassword', hash);
    expect(resultado).toBe(false);
  });
});