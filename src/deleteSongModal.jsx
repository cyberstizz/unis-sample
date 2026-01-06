import React from 'react';
import { X, AlertTriangle, Trash2 } from 'lucide-react';
import './deleteSongModal.scss';

const DeleteSongModal = ({ show, songTitle, onConfirm, onCancel, isDeleting }) => {
  if (!show) return null;

  return (
    <div className="delete-modal-overlay">
      <div className="delete-modal">
        <button className="close-button" onClick={onCancel} disabled={isDeleting}>
          <X size={24} />
        </button>

        <div className="modal-icon">
          <AlertTriangle size={48} />
        </div>

        <h2>Delete Song?</h2>

        <p className="modal-message">
          Are you sure you want to delete <strong>"{songTitle}"</strong>?
        </p>

        <p className="modal-warning">
          This action cannot be undone. The song will be permanently removed from your catalog.
        </p>

        <div className="modal-actions">
          <button
            className="cancel-button"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            className="delete-button"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              'Deleting...'
            ) : (
              <>
                <Trash2 size={16} /> Delete Song
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteSongModal;
