import React, { useState } from "react";
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { api } from "@meideate/convex";
import { useQuery, useMutation } from "@meideate/convex/react";
import { withUniwind } from "uniwind";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Id } from "@meideate/convex/dataModel";

const StyledSafeAreaView = withUniwind(SafeAreaView);
const StyledView = withUniwind(View);
const StyledText = withUniwind(Text);
const StyledTextInput = withUniwind(TextInput);
const StyledTouchableOpacity = withUniwind(TouchableOpacity);
const StyledScrollView = withUniwind(ScrollView);

export default function WorkspaceIdeas() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: Id<"workspaces"> }>();
  
  const workspace = useQuery(api.workspaces.get, { id: id as Id<"workspaces"> });
  const ideas = useQuery(api.ideas.listByWorkspace, { workspaceId: id as Id<"workspaces"> });
  
  const createIdeaMutation = useMutation(api.ideas.create);
  const removeIdeaMutation = useMutation(api.ideas.remove);

  const [newIdeaContent, setNewIdeaContent] = useState("");

  const handleCreateIdea = async () => {
    if (!newIdeaContent.trim() || !id) return;
    await createIdeaMutation({ 
      content: newIdeaContent, 
      workspaceId: id as Id<"workspaces"> 
    });
    setNewIdeaContent("");
  };

  const handleRemoveIdea = async (ideaId: any) => {
    await removeIdeaMutation({ id: ideaId });
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-[#0a0a0c]">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <StyledView className="flex-1 px-6 pt-4">
          <StyledView className="flex-row items-center gap-4 mb-8">
            <StyledTouchableOpacity 
              onPress={() => router.back()}
              className="p-2 rounded-xl bg-white/5"
            >
              <StyledText className="text-white font-bold text-xl">←</StyledText>
            </StyledTouchableOpacity>
            <StyledView className="flex-1">
              <StyledText className="text-2xl font-bold text-white tracking-tight truncate">
                {workspace?.name || "Loading..."}
              </StyledText>
              <StyledText className="text-indigo-400 text-xs font-bold uppercase tracking-widest">
                {ideas?.length || 0} Ideas Captured
              </StyledText>
            </StyledView>
          </StyledView>

          <StyledView className="flex-row gap-2 mb-6">
            <StyledTextInput
              className="flex-1 bg-[#111114] border border-white/5 rounded-2xl px-6 py-4 text-white font-medium shadow-2xl"
              placeholder="Capture an idea..."
              placeholderTextColor="#4a4a4a"
              value={newIdeaContent}
              onChangeText={setNewIdeaContent}
              multiline
            />
            <StyledTouchableOpacity
              className="bg-indigo-500 px-6 py-4 rounded-2xl justify-center items-center shadow-lg shadow-indigo-500/20"
              onPress={handleCreateIdea}
            >
              <StyledText className="text-white font-bold">Capture</StyledText>
            </StyledTouchableOpacity>
          </StyledView>

          <StyledScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
          >
            {ideas === undefined ? (
              <StyledText className="text-center py-4 text-slate-500 font-medium">
                Syncing with second brain...
              </StyledText>
            ) : ideas.length === 0 ? (
              <StyledText className="text-center py-12 text-slate-500 italic font-medium">
                No ideas captured yet in this workspace.
              </StyledText>
            ) : (
              <StyledView className="gap-4 pb-8">
                {ideas.map((idea: any) => (
                  <StyledView
                    key={idea._id}
                    className="bg-[#111114] border border-white/5 rounded-2xl p-6 shadow-sm"
                  >
                    <StyledView className="flex-row justify-between items-start gap-4">
                      <StyledText className="text-lg text-slate-200 leading-relaxed flex-1">
                        {idea.content}
                      </StyledText>
                      <StyledTouchableOpacity
                        className="p-1"
                        onPress={() => handleRemoveIdea(idea._id)}
                      >
                        <StyledText className="text-slate-700 font-bold text-lg">✕</StyledText>
                      </StyledTouchableOpacity>
                    </StyledView>
                    <StyledView className="mt-4 flex-row items-center gap-2">
                       <StyledView className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                       <StyledText className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                         Captured via Mobile
                       </StyledText>
                    </StyledView>
                  </StyledView>
                ))}
              </StyledView>
            )}
          </StyledScrollView>
        </StyledView>
      </KeyboardAvoidingView>
    </StyledSafeAreaView>
  );
}
