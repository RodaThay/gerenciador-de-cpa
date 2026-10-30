import React, { useState, useEffect, useMemo } from 'react';
import { PlusCircle, MinusCircle, Trash2, Copy, MonitorPlay } from 'lucide-react';
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp, query, orderBy, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';

export default function App() {
  const [ciclos, setCiclos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarCiclos();
  }, []);

  const carregarCiclos = async () => {
    try {
      const q = query(collection(db, 'ciclos'), orderBy('data', 'desc'));
      const querySnapshot = await getDocs(q);
      const ciclosFirebase = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCiclos(ciclosFirebase);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const adicionarCiclo = async () => {
    const novoCiclo = {
      data: serverTimestamp(),
      investido: 0,
      sacado: 0,
      telas: 1,
      depositos: [],
      saques: []
    };
    try {
      const docRef = await addDoc(collection(db, 'ciclos'), novoCiclo);
      setCiclos([{ id: docRef.id, ...novoCiclo, data: { toDate: () => new Date() } }, ...ciclos]);
    } catch (error) {
      console.error("Erro ao adicionar:", error);
    }
  };

  const deletarCiclo = async (id) => {
    if (!window.confirm("Tem certeza que deseja deletar este ciclo?")) return;
    try {
      await deleteDoc(doc(db, 'ciclos', id));
      setCiclos(ciclos.filter(ciclo => ciclo.id !== id));
    } catch (error) {
      console.error("Erro ao deletar:", error);
    }
  };

  const registrarTransacao = async (id, tipo, valorAtual) => {
    const nomeTransacao = tipo === 'deposito' ? 'DEPÓSITO' : 'SAQUE';
    const valorStr = window.prompt(`Digite o valor do ${nomeTransacao} (ex: 50.00):`);
    
    if (!valorStr) return;
    
    const valor = parseFloat(valorStr.replace(',', '.'));
    
    if (isNaN(valor) || valor <= 0) {
      alert("Por favor, digite um valor numérico válido maior que zero.");
      return;
    }

    // Cria o objeto da transação com a hora atual
    const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const novaTransacao = { valor, hora: horaAtual, id: Date.now() };

    try {
      const cicloRef = doc(db, 'ciclos', id);
      
      if (tipo === 'deposito') {
        await updateDoc(cicloRef, { 
          investido: valorAtual + valor,
          depositos: arrayUnion(novaTransacao)
        });
      } else {
        await updateDoc(cicloRef, { 
          sacado: valorAtual + valor,
          saques: arrayUnion(novaTransacao)
        });
      }

      // Atualiza o ecrã em tempo real
      setCiclos(ciclos.map(ciclo => {
        if (ciclo.id === id) {
          return {
            ...ciclo,
            investido: tipo === 'deposito' ? ciclo.investido + valor : ciclo.investido,
            sacado: tipo === 'saque' ? ciclo.sacado + valor : ciclo.sacado,
            depositos: tipo === 'deposito' ? [...(ciclo.depositos || []), novaTransacao] : (ciclo.depositos || []),
            saques: tipo === 'saque' ? [...(ciclo.saques || []), novaTransacao] : (ciclo.saques || [])
          };
        }
        return ciclo;
      }));
    } catch (error) {
      console.error("Erro ao registrar transação:", error);
      alert("Erro ao salvar no banco de dados.");
    }
  };

  const formatarDataCabecalho = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date();
    const dia = date.getDate();
    const mes = date.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
    const ano = date.getFullYear();
    const hora = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${dia} DE ${mes} • ${ano} • ${hora}`;
  };

  const ciclosAgrupados = useMemo(() => {
    const grupos = {};
    
    ciclos.forEach(ciclo => {
      const dateObj = ciclo.data && ciclo.data.toDate ? ciclo.data.toDate() : new Date();
      const formatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
      const dataFormatada = formatter.format(dateObj).toUpperCase();
      
      if (!grupos[dataFormatada]) {
        grupos[dataFormatada] = {
          dataTitulo: dataFormatada,
          ciclos: [],
          totalTelas: 0,
          totalInvestido: 0,
          totalSacado: 0
        };
      }
      
      grupos[dataFormatada].ciclos.push(ciclo);
      grupos[dataFormatada].totalTelas += (ciclo.telas || 1);
      grupos[dataFormatada].totalInvestido += (ciclo.investido || 0);
      grupos[dataFormatada].totalSacado += (ciclo.sacado || 0);
    });

    return Object.values(grupos);
  }, [ciclos]);

  if (loading) return <div className="min-h-screen bg-[#0F172A] text-white flex items-center justify-center">Carregando seus dados...</div>;

  return (
    <div className="min-h-screen bg-[#0F172A] text-gray-300 p-6 font-sans">
      <header className="mb-8 flex justify-between items-center pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wider">HISTÓRICO DE CICLOS</h1>
          <p className="text-sm text-gray-500 mt-1 uppercase">Monitoramento Geral</p>
        </div>
        <button 
          onClick={adicionarCiclo}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded flex items-center gap-2 transition cursor-pointer"
        >
          <PlusCircle size={18} /> Novo Ciclo
        </button>
      </header>

      {ciclosAgrupados.map((grupo, index) => {
        const resultadoDoDia = grupo.totalSacado - grupo.totalInvestido;

        return (
          <div key={index} className="mb-10">
            <div className="mb-4">
              <h2 className="text-xs font-bold text-gray-400 mb-2">{grupo.dataTitulo}</h2>
              <div className="bg-[#111A2C] border border-gray-800 rounded-lg p-3 flex flex-wrap items-center justify-between text-sm shadow-sm">
                <div className="flex items-center gap-6">
                  <span className="text-gray-500 font-bold uppercase tracking-wider text-xs">Total do Dia</span>
                  <span className="text-gray-300 font-semibold">Telas: <span className="text-white">{grupo.totalTelas}</span></span>
                  <span className="text-gray-400">Investido: <span className="text-red-400 font-semibold">R$ {grupo.totalInvestido.toFixed(2)}</span></span>
                  <span className="text-gray-400">Sacado: <span className="text-emerald-500 font-semibold">R$ {grupo.totalSacado.toFixed(2)}</span></span>
                </div>
                <div>
                  <span className="text-gray-400">Resultado: </span>
                  <span className={`font-bold ${resultadoDoDia >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {resultadoDoDia >= 0 ? '+' : ''} R$ {resultadoDoDia.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {grupo.ciclos.map((ciclo) => (
                <div key={ciclo.id} className="bg-[#172336] border border-gray-700 rounded-lg p-5 shadow-lg relative overflow-hidden flex flex-col">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-800"></div>
                  
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                      <div className="bg-[#0F172A] p-2 rounded text-emerald-500 mt-1">
                        <MonitorPlay size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">{formatarDataCabecalho(ciclo.data)}</p>
                        <h3 className="font-bold text-white text-lg">{ciclo.telas} tela ativa</h3>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <button className="text-gray-400 hover:text-white p-1 cursor-pointer"><Copy size={16} /></button>
                      <button onClick={() => deletarCiclo(ciclo.id)} className="text-red-400 hover:text-red-300 p-1 cursor-pointer"><Trash2 size={16} /></button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-center mb-6 bg-[#0F172A] p-4 rounded-lg border border-gray-800">
                    <div>
                      <p className="text-xs text-gray-500 mb-1 font-semibold uppercase">Investido</p>
                      <p className="text-red-400 font-bold text-xl">R$ {ciclo.investido.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1 font-semibold uppercase">Sacado</p>
                      <p className="text-emerald-500 font-bold text-xl">R$ {ciclo.sacado.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1 font-semibold uppercase">Resultado</p>
                      <p className={`font-bold text-xl ${(ciclo.sacado - ciclo.investido) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {(ciclo.sacado - ciclo.investido) >= 0 ? '+' : ''}R$ {(ciclo.sacado - ciclo.investido).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 mb-6">
                    <button 
                      onClick={() => registrarTransacao(ciclo.id, 'deposito', ciclo.investido)}
                      className="flex-1 border border-red-500/30 text-red-400 hover:bg-red-500/10 py-2 rounded flex justify-center items-center gap-2 text-sm font-semibold transition cursor-pointer"
                    >
                      <MinusCircle size={16} /> + DEPÓSITO
                    </button>
                    <button 
                      onClick={() => registrarTransacao(ciclo.id, 'saque', ciclo.sacado)}
                      className="flex-1 border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 py-2 rounded flex justify-center items-center gap-2 text-sm font-semibold transition cursor-pointer"
                    >
                      <PlusCircle size={16} /> + SAQUE
                    </button>
                  </div>

                  {/* Histórico de Transações */}
                  <div className="grid grid-cols-2 gap-4 mt-auto border-t border-gray-800 pt-4">
                    {/* Coluna Depósitos */}
                    <div>
                      <h4 className="text-[10px] text-red-500/80 font-bold mb-3 flex items-center gap-1 uppercase tracking-wider">
                        <MinusCircle size={12} /> Depósitos ({(ciclo.depositos || []).length})
                      </h4>
                      <div className="flex flex-col gap-2">
                        {(ciclo.depositos || []).map((dep) => (
                          <div key={dep.id} className="bg-[#0F172A] rounded p-2 flex justify-between items-center border border-gray-800/60">
                            <span className="text-red-500 text-xs font-bold">- R$ {dep.valor.toFixed(2)}</span>
                            <span className="text-gray-500 text-[10px]">{dep.hora}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Coluna Saques */}
                    <div>
                      <h4 className="text-[10px] text-emerald-500/80 font-bold mb-3 flex items-center gap-1 uppercase tracking-wider">
                        <PlusCircle size={12} /> Saques ({(ciclo.saques || []).length})
                      </h4>
                      <div className="flex flex-col gap-2">
                        {(ciclo.saques || []).map((saq) => (
                          <div key={saq.id} className="bg-[#0F172A] rounded p-2 flex justify-between items-center border border-gray-800/60">
                            <span className="text-emerald-500 text-xs font-bold">+ R$ {saq.valor.toFixed(2)}</span>
                            <span className="text-gray-500 text-[10px]">{saq.hora}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}