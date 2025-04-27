// simpleAuthMiddleware.js
const simpleAuthMiddleware = (req, res, next) => {
    // Data user yang diizinkan (simpan dalam memory)
    const allowedUsers = [
      {
        username: 'bukan_untuk_dicoba',
        password: 'admin123-petrus!@#', // Password harusnya di-hash dalam production
        apiKey: '123e4567-e89b-12d3-a456-426614174000',
        role: 'justdev'
      }
    ];
  
    try {
      // Cek API Key dari header
      const apiKey = req.headers['x-api-key'];
      
      // Cek Basic Auth dari header Authorization
      const authHeader = req.headers.authorization;
      let username, password;
  
      if (authHeader && authHeader.startsWith('Basic ')) {
        const base64Credentials = authHeader.split(' ')[1];
        const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
        [username, password] = credentials.split(':');
      }
  
      // Verifikasi
      const user = allowedUsers.find(u => 
        (u.apiKey === apiKey) || 
        (u.username === username && u.password === password)
      );
  
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized - Invalid credentials' });
      }
  
      // Attach user info ke request
      req.user = {
        username: user.username,
        role: user.role
      };
  
      next();
    } catch (error) {
      console.error('Auth error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
  
  export default simpleAuthMiddleware;