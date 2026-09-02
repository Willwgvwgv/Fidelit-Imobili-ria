export type RecurrenceDeleteOption = 'single' | 'following' | 'all';

export interface RecurrenceDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  option: RecurrenceDeleteOption;
  onOptionChange: (option: RecurrenceDeleteOption) => void;
  onConfirm: () => void;
}
