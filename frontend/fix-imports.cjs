const fs = require('fs');
const path = require('path');

// Mapping component names to new paths
const componentMapping = {
  'PostCard': 'Social/PostCard',
  'PostModal': 'Social/PostModal',
  'CreatePostCard': 'Social/CreatePostCard',
  'CommentForm': 'Social/CommentForm',
  'CommentList': 'Social/CommentList',
  'CommentsPanel': 'Social/CommentsPanel',
  'ShareModal': 'Social/ShareModal',
  'StoriesBar': 'Social/StoriesBar',
  'StoryModel': 'Social/StoryModel',
  'StoryViewer': 'Social/StoryViewer',
  'UserCard': 'Social/UserCard',
  'UserProfileInfo': 'Social/UserProfileInfo',
  'ProfileModal': 'Social/ProfileModal',
  'RecentMessages': 'Social/RecentMessages',
  'LiveVideo': 'Livestream/LiveVideo',
  'LiveRoomCard': 'Livestream/LiveRoomCard',
  'LiveRoomsSidebar': 'Livestream/LiveRoomsSidebar',
  'BookingModal': 'Sport/BookingModal',
  'Loading': 'Shared/Loading',
  'SideBar': 'Shared/SideBar',
  'MenuItems': 'Shared/MenuItems',
  'NotificationBell': 'Shared/NotificationBell',
  'GiftsBar': 'Shared/GiftsBar'
};

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (filePath.endsWith('.jsx') || filePath.endsWith('.js')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

const srcDir = path.join(__dirname, 'src');
const files = getAllFiles(srcDir);

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;

  // Fix component imports
  Object.keys(componentMapping).forEach(oldName => {
    const newPath = componentMapping[oldName];
    const regex = new RegExp(`(from\\s+['"](.*?)components/)${oldName}(['"])`, 'g');
    if (regex.test(content)) {
      content = content.replace(regex, `$1${newPath}$3`);
      modified = true;
    }
  });

  // Fix relative paths for pages in subdirectories
  if (file.includes('pages\\Social') || file.includes('pages\\Sport') || 
      file.includes('pages\\Auth') || file.includes('pages\\Livestream') || file.includes('pages\\Shared') ||
      file.includes('pages/Social') || file.includes('pages/Sport') ||
      file.includes('pages/Auth') || file.includes('pages/Livestream') || file.includes('pages/Shared')) {
    
    // Update imports from ../components to ../../components
    if (content.includes('from "../components')) {
      content = content.replace(/from ["']\.\.\/components\//g, 'from "../../components/');
      modified = true;
    }
    
    // Update imports from ../utils to ../../utils
    if (content.includes('from "../utils') || content.includes('from \'../utils')) {
      content = content.replace(/from ["']\.\.\/utils\//g, 'from "../../utils/');
      modified = true;
    }
    
    // Update imports from ../hooks to ../../hooks
    if (content.includes('from "../hooks') || content.includes('from \'../hooks')) {
      content = content.replace(/from ["']\.\.\/hooks\//g, 'from "../../hooks/');
      modified = true;
    }

    // Update ../App.css to ../../App.css
    if (content.includes('"../App.css"') || content.includes('\'../App.css\'')) {
      content = content.replace(/["']\.\.\/App\.css["']/g, '"../../App.css"');
      modified = true;
    }

    // Update ../assets to ../../assets
    if (content.includes('"../assets') || content.includes('\'../assets')) {
      content = content.replace(/["']\.\.\/assets/g, '"../../assets');
      modified = true;
    }

    // Update ../CSS to ../../CSS
    if (content.includes('"../CSS') || content.includes('\'../CSS')) {
      content = content.replace(/["']\.\.\/CSS/g, '"../../CSS');
      modified = true;
    }
  }

  // Fix component imports from subdirectories
  if (file.includes('components\\Social') || file.includes('components\\Sport') ||
      file.includes('components\\Livestream') || file.includes('components\\Shared') ||
      file.includes('components/Social') || file.includes('components/Sport') ||
      file.includes('components/Livestream') || file.includes('components/Shared')) {
    
    // Update imports from ../utils to ../../utils
    if (content.includes('from "../utils') || content.includes('from \'../utils')) {
      content = content.replace(/from ["']\.\.\/utils\//g, 'from "../../utils/');
      modified = true;
    }
    
    // Update imports from ../hooks to ../../hooks
    if (content.includes('from "../hooks') || content.includes('from \'../hooks')) {
      content = content.replace(/from ["']\.\.\/hooks\//g, 'from "../../hooks/');
      modified = true;
    }

    // Update ../assets to ../../assets
    if (content.includes('"../assets') || content.includes('\'../assets')) {
      content = content.replace(/["']\.\.\/assets/g, '"../../assets');
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed:', file);
  }
});

console.log('Done!');
