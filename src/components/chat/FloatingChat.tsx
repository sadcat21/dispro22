import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MessageCircle, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useChat } from '@/hooks/useChat';
import ConversationList from './ConversationList';
import ChatView from './ChatView';
import NewChatDialog from './NewChatDialog';

const FloatingChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const queryClient = useQueryClient();

  const { conversations, sendMessage, createConversation, markAsRead, uploadMedia, totalUnread } = useChat();

  const selectedConv = conversations.find(c => c.id === selectedConvId);

  const handleSelect = (id: string) => {
    setSelectedConvId(id);
    markAsRead(id);
  };

  const handleNewChat = async (type: 'direct' | 'group', participantIds: string[], name?: string) => {
    const result = await createConversation.mutateAsync({ type, participantIds, name });
    if (result) {
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setSelectedConvId(result.id);
      setShowNewChat(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <div className="fixed bottom-20 left-4 z-50">
        <Button
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg relative"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
          {totalUnread > 0 && !isOpen && (
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 min-w-[20px] text-[10px]">
              {totalUnread}
            </Badge>
          )}
        </Button>
      </div>

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-36 left-4 z-50 w-[340px] h-[480px] bg-background border rounded-2xl shadow-2xl flex overflow-hidden">
          {selectedConvId && !selectedConv ? (
            <div className="h-full w-full flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : selectedConv ? (
            <ChatView
              conversation={selectedConv}
              onSend={(msg) => sendMessage.mutate({ conversationId: selectedConv.id, message: msg })}
              onUpload={uploadMedia}
              onBack={() => setSelectedConvId(null)}
            />
          ) : (
            <ConversationList
              conversations={conversations}
              selectedId={null}
              onSelect={handleSelect}
              onNewChat={() => setShowNewChat(true)}
            />
          )}
        </div>
      )}

      <NewChatDialog
        open={showNewChat}
        onClose={() => setShowNewChat(false)}
        onCreate={handleNewChat}
      />
    </>
  );
};

export default FloatingChat;
