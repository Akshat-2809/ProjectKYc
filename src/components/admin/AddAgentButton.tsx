"use client";

import { useRef, useState } from "react";
import { PlusIcon } from "@/components/Icons";
import { CreateAgentForm } from "./CreateAgentForm";

/** "Add agent" button in the admin top bar; opens the create-agent form in a dialog. */
export function AddAgentButton() {
  const ref = useRef<HTMLDialogElement>(null);
  const [round, setRound] = useState(0); // fresh, empty form each time the dialog opens

  const open = () => {
    setRound((r) => r + 1);
    ref.current?.showModal();
  };
  const close = () => ref.current?.close();

  return (
    <>
      <button type="button" className="btn btn-primary btn-sm nav-add" onClick={open}>
        <PlusIcon size={16} />
        <span className="nav-add-label">Add agent</span>
      </button>
      <dialog
        ref={ref}
        className="confirm agent-dialog"
        aria-labelledby="add-agent-title"
        onClick={(e) => {
          // Clicking the dimmed backdrop closes it
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className="confirm-body">
          <CreateAgentForm key={round} onClose={close} />
        </div>
      </dialog>
    </>
  );
}
