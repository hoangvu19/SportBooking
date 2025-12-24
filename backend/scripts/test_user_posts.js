const PostDAL = require('../DAL/Social/PostDAL');

(async () => {
  try {
    const posts = await PostDAL.getByUserId(1, 1, 10);
    console.log('User posts (1):', JSON.stringify(posts, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
