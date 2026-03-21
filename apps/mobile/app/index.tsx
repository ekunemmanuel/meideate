import React, { useState } from "react";
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { api } from "@meideate/convex";
import { useQuery, useMutation } from "@meideate/convex/react";
import { withUniwind } from "uniwind";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

const StyledSafeAreaView = withUniwind(SafeAreaView);
const StyledView = withUniwind(View);
const StyledText = withUniwind(Text);
const StyledTextInput = withUniwind(TextInput);
const StyledTouchableOpacity = withUniwind(TouchableOpacity);
const StyledScrollView = withUniwind(ScrollView);

export default function WorkspacesIndex() {
  const router = useRouter();
  const workspaces = useQuery(api.workspaces.list);
  const createWorkspaceMutation = useMutation(api.workspaces.create);
  const removeWorkspaceMutation = useMutation(api.workspaces.remove);
  const seedMutation = useMutation(api.seed.seed);

  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [modalVisible, setModalVisible] = useState(false);

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;
    const id = await createWorkspaceMutation({ name: newWorkspaceName });
    setNewWorkspaceName("");
    setModalVisible(false);
    if (id) router.push(`/workspace/${id}`);
  };

  const handleRemoveWorkspace = async (id: any) => {
    await removeWorkspaceMutation({ id });
  };

  const runSeed = async () => {
    await seedMutation({});
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-[#0a0a0c]">
      <StyledView className="flex-1 px-6 pt-8">
        <StyledView className="flex-row items-center justify-between mb-8">
          <StyledView>
            <StyledText className="text-3xl font-bold text-white tracking-tight">
              Meideate
            </StyledText>
            <StyledText className="text-slate-500 mt-1 font-medium text-sm">
              Your Second Brain
            </StyledText>
          </StyledView>
          <StyledTouchableOpacity
            className="w-10 h-10 bg-indigo-500 rounded-xl items-center justify-center shadow-lg shadow-indigo-500/20"
            onPress={() => setModalVisible(true)}
          >
            <StyledText className="text-white text-2xl font-bold">+</StyledText>
          </StyledTouchableOpacity>
        </StyledView>

        <StyledScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {workspaces === undefined ? (
            <StyledText className="text-center py-4 text-slate-500 font-medium">
              Syncing workspaces...
            </StyledText>
          ) : workspaces.length === 0 ? (
            <StyledView className="items-center py-12">
              <StyledText className="text-center text-slate-500 italic font-medium mb-4">
                No workspaces found.
              </StyledText>
              <StyledTouchableOpacity onPress={runSeed}>
                <StyledText className="text-indigo-400 font-bold">Populate Seed Data</StyledText>
              </StyledTouchableOpacity>
            </StyledView>
          ) : (
            <StyledView className="gap-4 pb-8">
              {workspaces.map((workspace) => (
                <StyledTouchableOpacity
                  key={workspace._id}
                  className="bg-[#111114] border border-white/5 rounded-2xl p-6 flex-row items-center justify-between shadow-lg"
                  onPress={() => router.push(`/workspace/${workspace._id}`)}
                >
                  <StyledView className="flex-1">
                    <StyledText className="text-xl font-bold text-white">
                      {workspace.name}
                    </StyledText>
                    {workspace.description && (
                      <StyledText className="text-slate-500 text-sm mt-1">
                        {workspace.description}
                      </StyledText>
                    )}
                  </StyledView>
                  <StyledTouchableOpacity
                    className="p-2"
                    onPress={() => handleRemoveWorkspace(workspace._id)}
                  >
                    <StyledText className="text-slate-700 font-bold text-lg">✕</StyledText>
                  </StyledTouchableOpacity>
                </StyledTouchableOpacity>
              ))}
            </StyledView>
          )}
        </StyledScrollView>
      </StyledView>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <StyledView className="flex-1 justify-end bg-black/60">
          <StyledView className="bg-[#111114] border-t border-white/10 rounded-t-[40px] p-8 pb-12 shadow-2xl">
            <StyledText className="text-2xl font-bold text-white mb-6">
              New Workspace
            </StyledText>
            <StyledTextInput
              className="bg-black/20 border border-white/5 rounded-2xl px-6 py-4 text-white font-medium mb-6"
              placeholder="Workspace Name (e.g. Ideas)"
              placeholderTextColor="#4a4a4a"
              value={newWorkspaceName}
              onChangeText={setNewWorkspaceName}
              autoFocus
            />
            <StyledView className="flex-row gap-4">
              <StyledTouchableOpacity
                className="flex-1 bg-white/5 py-4 rounded-2xl items-center"
                onPress={() => setModalVisible(false)}
              >
                <StyledText className="text-slate-400 font-bold">Cancel</StyledText>
              </StyledTouchableOpacity>
              <StyledTouchableOpacity
                className="flex-2 bg-indigo-500 py-4 rounded-2xl items-center shadow-lg shadow-indigo-500/20"
                onPress={handleCreateWorkspace}
              >
                <StyledText className="text-white font-bold">Create</StyledText>
              </StyledTouchableOpacity>
            </StyledView>
          </StyledView>
        </StyledView>
      </Modal>
    </StyledSafeAreaView>
  );
}
