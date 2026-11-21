import type { ApplicantAnswerDto } from '../model/types';

interface ApplicantAnswerListProps {
  answers: ApplicantAnswerDto[];
}

/**
 * 지원서 문항과 답변. 서버가 준 순서(order_num 오름차순)대로 그린다. label은 위의 작은 보조 글씨, content는 질문 제목이다.
 * TEXT는 줄바꿈을 살린 문단, TABLE은 항목명·답변 두 칸 표로 그린다. 개인 평가 화면과 지원서 상세 창이 함께 쓴다.
 */
export function ApplicantAnswerList({ answers }: ApplicantAnswerListProps) {
  return (
    <>
      {answers.map((answer) => (
        <section className="review-question" key={answer.question_id}>
          <div className="review-question-title">
            {answer.label && <span>{answer.label}</span>}
            <h2>{answer.content}</h2>
          </div>
          {answer.type === 'TABLE' && answer.answer && typeof answer.answer === 'object' ? (
            <table className="review-answer-table">
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
