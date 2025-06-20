interface MediaToggleButtonProps {
    labelOn: string;
    labelOff: string;
    isOn: boolean;
    onClick: () => void;
    disabled?: boolean;
}

export default function MediaToggleButton({
    labelOn,
    labelOff,
    isOn,
    onClick,
    disabled = false,
}: MediaToggleButtonProps) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className="button"
            aria-label={isOn ? labelOn : labelOff}
        >
            {isOn ? labelOn : labelOff}
        </button>
    );
}
