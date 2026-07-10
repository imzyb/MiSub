export function useBackdropDismiss(onDismiss, canDismiss = () => true) {
  let pointerDownStartedOnBackdrop = false;

  const handleBackdropPointerDown = (event) => {
    pointerDownStartedOnBackdrop = event.target === event.currentTarget;
  };

  const handleBackdropClick = (event) => {
    const shouldDismiss = pointerDownStartedOnBackdrop && event.target === event.currentTarget;
    pointerDownStartedOnBackdrop = false;

    if (shouldDismiss && canDismiss()) {
      onDismiss(event);
    }
  };

  return {
    handleBackdropPointerDown,
    handleBackdropClick
  };
}
