import type { ApplicantAnswerDto } from '../model/types';

interface ApplicantAnswerListProps {
  answers: ApplicantAnswerDto[];
}

/** 지원서 문항과 답변. TEXT는 문단, TABLE은 항목별 표로 그린다. 개인 평가 화면과 지원서 상세 창이 함께 쓴다. */
export function ApplicantAnswerList({ answers }: ApplicantAnswerListProps) {
  return (
    <>
      {answers.map((answer, index) => (
        <section className="review-question" key={answer.question_id}>
          <div className="review-question-title">
            <span>{answer.label || String(index + 1).padStart(2, '0')}</span>
            <h2>{answer.content}</h2>
          </div>
          {answer.type === 'TABLE' && answer.answer && typeof answer.answer === 'object' ? (
            <table>
              <tbody>
                {Object.entries(answer.answer).map(([key, value]) => (
                  <tr key={key}>
                    <th scope="row">{key}</th>
                    <td>{String(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="review-answer">{String(answer.answer ?? '')}</p>
          )}
        </section>
      ))}
      {!answers.length && (
        <p className="review-answer review-answers-empty">제출된 답변이 없습니다.</p>
      )}
    </>
  );
}
