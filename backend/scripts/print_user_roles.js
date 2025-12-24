const AccountDAL = require('../DAL/Auth/accountDAL');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

async function main() {
  try {
    const id = process.argv[2] ? parseInt(process.argv[2], 10) : 84;
    const user = await AccountDAL.getById(id);
    if (!user) {
      console.log(`No user found for AccountID=${id}`);
      process.exit(0);
    }
    const frontend = user.toFrontendFormat();
    console.log(JSON.stringify(frontend, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error fetching user:', err && (err.message || err));
    process.exit(1);
  }
}

main();
