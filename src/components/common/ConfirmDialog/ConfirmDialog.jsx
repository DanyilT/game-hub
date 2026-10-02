import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router';
import { answerQuestion, getQuestion, subscribeQuestion } from '../../../lib/confirm';
import Button from '../Button/Button';
import Modal from '../Modal/Modal';
import styles from './ConfirmDialog.module.scss';

/** One question: yes, or no (Cancel, Escape, the × or a click outside) */
const Question = ({ question }) => {
  const { id, title, message, confirmLabel, danger } = question;
  const confirmRef = useRef(null);
  const cancelRef = useRef(null);
  const no = () => answerQuestion(false, id);
  return (
    // Removing something: No has the focus, so a stray Enter keeps it
    <Modal title={title} onClose={no} initialFocusRef={danger ? cancelRef : confirmRef}>
      {message && <p className={styles.message}>{message}</p>}
      <div className={styles.actions}>
        <Button ref={cancelRef} variant="outline" onClick={no}>Cancel</Button>
        <Button ref={confirmRef} variant={danger ? 'danger' : 'primary'} onClick={() => answerQuestion(true, id)}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
};

/**
 * The questions from askToConfirm (src/lib/confirm.js), in the site's own window. MainLayout renders it once.
 * Going to another page answers no: the question was about the page that's gone.
 */
const ConfirmDialog = () => {
  const question = useSyncExternalStore(subscribeQuestion, getQuestion);
  const { key } = useLocation();
  useEffect(() => () => answerQuestion(false), [key]);

  return question && <Question key={question.id} question={question} />;
};

export default ConfirmDialog;
