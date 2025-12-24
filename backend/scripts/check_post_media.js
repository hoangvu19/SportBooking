const MediaAssetDAL = require('../DAL/Social/MediaAssetDAL');

(async () => {
  try {
    const rows = await MediaAssetDAL.getByTarget('Post', '237');
    console.log('MediaAsset rows for Post 237:', JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error querying MediaAssetDAL:', err);
    process.exit(1);
  }
})();
