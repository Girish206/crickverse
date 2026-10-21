import { useEffect, useState, type ReactNode } from "react";
import ReactDOM from "react-dom";
import { ModalContext } from "./modalContext";

export type ModalSize = "sm" | "md" | "lg" | "xl" | string;

// Number of DefaultModals currently open, so a modal opened from another
// modal doesn't unlock the page when the inner one closes.
let openModalCount = 0;

// Hides the page's scrollbar while a modal is open, padding <body> by the
// scrollbar's width so the content behind doesn't shift sideways. Returns
// the cleanup that restores it once the last open modal closes.
function lockBodyScroll() {
    const body = document.body;
    if (openModalCount === 0) {
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        body.classList.add("modal-open");
        body.style.overflow = "hidden";
        if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
    }
    openModalCount += 1;
    return () => {
        openModalCount -= 1;
        if (openModalCount === 0) {
            body.classList.remove("modal-open");
            body.style.overflow = "";
            body.style.paddingRight = "";
        }
    };
}

interface DefaultModalProps {
    title: string;
    component: ReactNode;
    onClose: () => void;
    modalClass?: string;
    size?: ModalSize;
    showFooter?: boolean;
    footer?: ReactNode;
}

const DefaultModal = ({
    title,
    component,
    onClose,
    modalClass = "",
    size = "xl",
    showFooter = true,
    footer,
}: DefaultModalProps) => {
    const [visible, setVisible] = useState(false);
    // Footer slot that forms portal their Cancel/Save buttons into.
    const [footerSlot, setFooterSlot] = useState<HTMLDivElement | null>(null);
    useEffect(() => {
        // Trigger show animation after mount
        setTimeout(() => setVisible(true), 10);
    }, []);

    // Bootstrap's JS (not used here) locks page scrolling while a modal is
    // open. Without that, the page keeps its scrollbar AND the full-screen
    // .modal layer shows its own, so two scrollbars appear side by side.
    useEffect(() => lockBodyScroll(), []);
    const closeModal = () => {
        setVisible(false);
        setTimeout(() => {
            onClose(); // Remove modal after animation
        }, 300); // Match Bootstrap animation duration
    };

    const getSizeClass = (modalSize?: string) => {
        if (!modalSize) return "modal-xl";
        if (modalSize === "sm") return "modal-sm";
        if (modalSize === "md") return "";
        if (modalSize === "lg") return "modal-lg";
        if (modalSize === "xl") return "modal-xl";
        return modalSize.startsWith("modal-") ? modalSize : `modal-${modalSize}`;
    };

    const modalContent = (
        <div
            className={`modal fade ${
                visible ? "show d-block" : "d-block"
            } ${modalClass}`}
            style={{
                backgroundColor: "rgba(0,0,0,0.5)",
                transition: "opacity 0.3s ease",
            }}
            tabIndex={-1}
            role="dialog"
        >
            <div
                className={`modal-dialog modal-dialog-centered modal-dialog-scrollable ${getSizeClass(size)}`}
                style={{ zIndex: 1105 }}
            >
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title">{title}</h5>
                        <button
                            type="button"
                            className="btn-close"
                            onClick={closeModal}
                            aria-label="Close"
                        />
                    </div>

                    <ModalContext.Provider value={{ footer: footerSlot, close: closeModal }}>
                        <div className="modal-body">{component}</div>
                    </ModalContext.Provider>
                    {showFooter || footer ? (
                        <div className="modal-footer">
                            {footer || (
                                <button
                                    type="button"
                                    className="btn btn-custom-secondary"
                                    onClick={closeModal}
                                >
                                    Close
                                </button>
                            )}
                        </div>
                    ) : (
                        // Empty until a form portals its actions in; hidden
                        // via CSS while empty.
                        <div className="modal-footer admin-modal-footer-slot" ref={setFooterSlot} />
                    )}
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
};

export default DefaultModal;
