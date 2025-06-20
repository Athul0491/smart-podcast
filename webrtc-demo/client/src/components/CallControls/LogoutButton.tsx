interface LogoutButtonProps {
    onClick: () => void;
}

export default function LogoutButton({ onClick }: LogoutButtonProps) {
    return (
        <button
            onClick={onClick}
            className="button"
            aria-label="Logout"
        >
            Logout
        </button>
    );
}
