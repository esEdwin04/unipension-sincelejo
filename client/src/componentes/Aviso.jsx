// Mensajes de estado (ok / error / info) con el estilo de la casa
export default function Aviso({ tipo = 'info', children }) {
  if (!children) return null;
  if (typeof children === 'string')
    return <div className={`aviso ${tipo}`} dangerouslySetInnerHTML={{ __html: children }} />;
  return <div className={`aviso ${tipo}`}>{children}</div>;
}
