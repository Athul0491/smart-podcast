interface RecordControlButtonProps {
    label: string;
    onClick: () => void;
    disabled?: boolean;
}

export default function RecordControlButton({
    label,
    onClick,
    disabled = false,
}: RecordControlButtonProps) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className="button"
            aria-label={label}
        >
            {label}
        </button>
    );
}
