


/* === ADSL28 - DATABASE MANIFEST === */
/*
 * Đây là tệp duy nhất bạn cần sửa khi thêm hoặc bớt các môn học.
 * Chương trình sẽ tự động tải các tệp được liệt kê dưới đây.
 */
//================================================================

const DATABASE_FILES = [
     'lichsudiali.js',
    'CIE6TW6.js',
    'questiontest.js',
    'nguvan6.js',
    'TOAN6.js',

 // Thêm các tệp .js database khác của bạn ở đây
];

//================================================================
// Hàm này sẽ tự động dùng document.write để tải các tệp database
DATABASE_FILES.forEach(filePath => {
    document.write(`<script src="${filePath}"></script>`);
});

// (Đã xóa dấu '}' bị thừa từ đây)






