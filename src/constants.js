// Vị trí & kích thước hố đen (đơn vị world).
// Đặt tại [0, 64, -150] với bán kính chân trời sự kiện R_HORIZON = 16 và đĩa bồi tụ mở rộng tới 96
// giúp hố đen + đĩa bồi tụ chiếm ~40% khung hình ở góc nhìn ngước lên từ mặt đất (y = 1.7m).
export const HOLE = [0, 64, -150]
export const R_HORIZON = 16 // Bán kính Chân trời sự kiện (Event Horizon)
export const DISK_IN = 21.5 // Vành trong đĩa bồi tụ (ISCO)
export const DISK_OUT = 96 // Vành ngoài đĩa bồi tụ
export const DISK_TILT = -1.16 // Rad, góc nghiêng đĩa bồi tụ tạo hiệu ứng Gargantua điện ảnh
export const DISK_ROLL = 0.16 // Rad, xoay nhẹ trục Z tạo bố cục bất đối xứng tự nhiên

export const CAM_START = [0, 1.7, 14]
export const LOOK_START = [0, 50, -150]
