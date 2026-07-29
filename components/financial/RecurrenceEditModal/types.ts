export interface RecurrenceEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  option: 'single' | 'following' | 'all';
  onOptionChange: (option: 'single' | 'following' | 'all') => void;
  onConfirm: () => void;
}
