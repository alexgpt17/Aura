import React from 'react';
import ModernColorPickerModal from './ModernColorPickerModal';

interface WheelColorPickerModalProps {
  visible: boolean;
  initialColor: string;
  onColorSelect: (color: string) => void;
  onClose: () => void;
  title?: string;
}

const WheelColorPickerModal: React.FC<WheelColorPickerModalProps> = ({
  visible,
  initialColor,
  onColorSelect,
  onClose,
  title = 'Select Color',
}) => {
  return (
    <ModernColorPickerModal
      visible={visible}
      initialColor={initialColor}
      onColorSelect={onColorSelect}
      onClose={onClose}
      title={title}
    />
  );
};


export default WheelColorPickerModal;
