-- comment_image_inserts_for_review.sql
-- Template SQL to insert CommentImage rows for files in backend/uploads/comments.
-- For each file below, replace <COMMENT_ID> with the actual CommentID that the image belongs to
-- then run this script in SQL Server Management Studio (or via your SQL client).
-- Each INSERT is guarded with IF NOT EXISTS so re-running is safe.

SET NOCOUNT ON;
BEGIN TRANSACTION;
BEGIN TRY

-- Replace <COMMENT_ID> with the real CommentID for each file

-- File: 1759634586009_z7ps2a.png
IF NOT EXISTS (SELECT 1 FROM CommentImage WHERE CommentID = <COMMENT_ID> AND ImageUrl = '/uploads/comments/1759634586009_z7ps2a.png')
BEGIN
  INSERT INTO CommentImage (CommentID, ImageUrl, UploadedDate) VALUES (<COMMENT_ID>, '/uploads/comments/1759634586009_z7ps2a.png', GETDATE());
END

-- File: 1759634784738_scbbhh.png
IF NOT EXISTS (SELECT 1 FROM CommentImage WHERE CommentID = <COMMENT_ID> AND ImageUrl = '/uploads/comments/1759634784738_scbbhh.png')
BEGIN
  INSERT INTO CommentImage (CommentID, ImageUrl, UploadedDate) VALUES (<COMMENT_ID>, '/uploads/comments/1759634784738_scbbhh.png', GETDATE());
END

-- File: 1759634791239_1797f4.png
IF NOT EXISTS (SELECT 1 FROM CommentImage WHERE CommentID = <COMMENT_ID> AND ImageUrl = '/uploads/comments/1759634791239_1797f4.png')
BEGIN
  INSERT INTO CommentImage (CommentID, ImageUrl, UploadedDate) VALUES (<COMMENT_ID>, '/uploads/comments/1759634791239_1797f4.png', GETDATE());
END

-- File: 1759636066923_a20bft.jpg
IF NOT EXISTS (SELECT 1 FROM CommentImage WHERE CommentID = <COMMENT_ID> AND ImageUrl = '/uploads/comments/1759636066923_a20bft.jpg')
BEGIN
  INSERT INTO CommentImage (CommentID, ImageUrl, UploadedDate) VALUES (<COMMENT_ID>, '/uploads/comments/1759636066923_a20bft.jpg', GETDATE());
END

-- File: 1759638868528_rswpjb.jpg
IF NOT EXISTS (SELECT 1 FROM CommentImage WHERE CommentID = <COMMENT_ID> AND ImageUrl = '/uploads/comments/1759638868528_rswpjb.jpg')
BEGIN
  INSERT INTO CommentImage (CommentID, ImageUrl, UploadedDate) VALUES (<COMMENT_ID>, '/uploads/comments/1759638868528_rswpjb.jpg', GETDATE());
END

-- File: 1759640312912_l4wit8.jpg
IF NOT EXISTS (SELECT 1 FROM CommentImage WHERE CommentID = <COMMENT_ID> AND ImageUrl = '/uploads/comments/1759640312912_l4wit8.jpg')
BEGIN
  INSERT INTO CommentImage (CommentID, ImageUrl, UploadedDate) VALUES (<COMMENT_ID>, '/uploads/comments/1759640312912_l4wit8.jpg', GETDATE());
END

-- File: 1759641011897_bgzec1.jpg
IF NOT EXISTS (SELECT 1 FROM CommentImage WHERE CommentID = <COMMENT_ID> AND ImageUrl = '/uploads/comments/1759641011897_bgzec1.jpg')
BEGIN
  INSERT INTO CommentImage (CommentID, ImageUrl, UploadedDate) VALUES (<COMMENT_ID>, '/uploads/comments/1759641011897_bgzec1.jpg', GETDATE());
END

-- File: 1759742671050_2gjibc.jpg
IF NOT EXISTS (SELECT 1 FROM CommentImage WHERE CommentID = <COMMENT_ID> AND ImageUrl = '/uploads/comments/1759742671050_2gjibc.jpg')
BEGIN
  INSERT INTO CommentImage (CommentID, ImageUrl, UploadedDate) VALUES (<COMMENT_ID>, '/uploads/comments/1759742671050_2gjibc.jpg', GETDATE());
END

-- File: 1759742671150_ltyopi.jpg
IF NOT EXISTS (SELECT 1 FROM CommentImage WHERE CommentID = <COMMENT_ID> AND ImageUrl = '/uploads/comments/1759742671150_ltyopi.jpg')
BEGIN
  INSERT INTO CommentImage (CommentID, ImageUrl, UploadedDate) VALUES (<COMMENT_ID>, '/uploads/comments/1759742671150_ltyopi.jpg', GETDATE());
END

-- File: 1759743956357_a20tun.jpg
IF NOT EXISTS (SELECT 1 FROM CommentImage WHERE CommentID = <COMMENT_ID> AND ImageUrl = '/uploads/comments/1759743956357_a20tun.jpg')
BEGIN
  INSERT INTO CommentImage (CommentID, ImageUrl, UploadedDate) VALUES (<COMMENT_ID>, '/uploads/comments/1759743956357_a20tun.jpg', GETDATE());
END

-- File: 1759743956497_8m9jtr.jpg
IF NOT EXISTS (SELECT 1 FROM CommentImage WHERE CommentID = <COMMENT_ID> AND ImageUrl = '/uploads/comments/1759743956497_8m9jtr.jpg')
BEGIN
  INSERT INTO CommentImage (CommentID, ImageUrl, UploadedDate) VALUES (<COMMENT_ID>, '/uploads/comments/1759743956497_8m9jtr.jpg', GETDATE());
END

-- File: 1759743956588_zxgi6t.jpg
IF NOT EXISTS (SELECT 1 FROM CommentImage WHERE CommentID = <COMMENT_ID> AND ImageUrl = '/uploads/comments/1759743956588_zxgi6t.jpg')
BEGIN
  INSERT INTO CommentImage (CommentID, ImageUrl, UploadedDate) VALUES (<COMMENT_ID>, '/uploads/comments/1759743956588_zxgi6t.jpg', GETDATE());
END

-- File: 1759743956693_o07sbx.jpg
IF NOT EXISTS (SELECT 1 FROM CommentImage WHERE CommentID = <COMMENT_ID> AND ImageUrl = '/uploads/comments/1759743956693_o07sbx.jpg')
BEGIN
  INSERT INTO CommentImage (CommentID, ImageUrl, UploadedDate) VALUES (<COMMENT_ID>, '/uploads/comments/1759743956693_o07sbx.jpg', GETDATE());
END

-- File: 1759752170506_19hdka.jpg
IF NOT EXISTS (SELECT 1 FROM CommentImage WHERE CommentID = <COMMENT_ID> AND ImageUrl = '/uploads/comments/1759752170506_19hdka.jpg')
BEGIN
  INSERT INTO CommentImage (CommentID, ImageUrl, UploadedDate) VALUES (<COMMENT_ID>, '/uploads/comments/1759752170506_19hdka.jpg', GETDATE());
END

-- File: 1759804694336_3bnayc.jpg
IF NOT EXISTS (SELECT 1 FROM CommentImage WHERE CommentID = <COMMENT_ID> AND ImageUrl = '/uploads/comments/1759804694336_3bnayc.jpg')
BEGIN
  INSERT INTO CommentImage (CommentID, ImageUrl, UploadedDate) VALUES (<COMMENT_ID>, '/uploads/comments/1759804694336_3bnayc.jpg', GETDATE());
END

-- File: 1759804716436_sys4sy.jpg
IF NOT EXISTS (SELECT 1 FROM CommentImage WHERE CommentID = <COMMENT_ID> AND ImageUrl = '/uploads/comments/1759804716436_sys4sy.jpg')
BEGIN
  INSERT INTO CommentImage (CommentID, ImageUrl, UploadedDate) VALUES (<COMMENT_ID>, '/uploads/comments/1759804716436_sys4sy.jpg', GETDATE());
END

COMMIT TRANSACTION;
PRINT 'Template generated. Replace <COMMENT_ID> placeholders then run.';
