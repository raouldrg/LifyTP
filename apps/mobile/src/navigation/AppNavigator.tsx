import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LiquidGlassTabBar } from "../components/LiquidGlassTabBar";
import LoadingScreen from "../screens/LoadingScreen";
import LoginScreen from "../screens/LoginScreen";
import SignUpScreen from "../screens/SignUpScreen";
import UsernameScreen from "../screens/UsernameScreen";
import PseudoScreen from "../screens/PseudoScreen";
import BioScreen from "../screens/BioScreen";
import AvatarScreen from "../screens/AvatarScreen";
import SettingsScreen from "../screens/SettingsScreen";
import { useAuth } from "../context/AuthContext";
import HomeScreen from "../screens/HomeScreen";
import SearchScreen from "../screens/SearchScreen";
import MessagesScreen from "../screens/MessagesScreen";
import ProfileScreen from "../screens/ProfileScreen";
import MyEventsScreen from "../screens/MyEventsScreen";
import ProfileControlCenterScreen from "../screens/ProfileControlCenterScreen";
import EditProfileScreen from "../screens/EditProfileScreen";
import ChangePasswordScreen from "../screens/ChangePasswordScreen";
import LikedItemsScreen from "../screens/LikedItemsScreen";
import AccountSwitcherScreen from "../screens/AccountSwitcherScreen";
import { theme } from "../theme";

import ChatScreen from "../screens/ChatScreen";
import NewMessageScreen from "../screens/NewMessageScreen";
import UserListScreen from "../screens/UserListScreen";
import ConversationSettingsScreen from "../screens/ConversationSettingsScreen";
import MessageRequestsScreen from "../screens/MessageRequestsScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const SearchStack = createNativeStackNavigator();
function SearchStackNavigator() {
    return (
        <SearchStack.Navigator
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
                animationDuration: 280,
                gestureEnabled: true,
                gestureDirection: 'horizontal',
            }}
        >
            <SearchStack.Screen name="SearchIndex" component={SearchScreen} />
            <SearchStack.Screen name="UserProfile" component={ProfileScreen} />
        </SearchStack.Navigator>
    );
}

const ProfileStack = createNativeStackNavigator();
function ProfileStackNavigator() {
    return (
        <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
            <ProfileStack.Screen name="ProfileIndex" component={ProfileScreen} />
            <ProfileStack.Screen name="MyEvents" component={MyEventsScreen} />
            <ProfileStack.Screen name="UserList" component={UserListScreen} />
            <ProfileStack.Screen name="UserProfile" component={ProfileScreen} />
            <ProfileStack.Screen name="ProfileControlCenter" component={ProfileControlCenterScreen} />
            <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} />
            <ProfileStack.Screen name="ChangePassword" component={ChangePasswordScreen} />
            <ProfileStack.Screen name="LikedItems" component={LikedItemsScreen} />
            <ProfileStack.Screen name="AccountSwitcher" component={AccountSwitcherScreen} />
        </ProfileStack.Navigator>
    );
}

const MessagesStack = createNativeStackNavigator();
function MessagesStackNavigator() {
    return (
        <MessagesStack.Navigator
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
                animationDuration: 280,
                gestureEnabled: true,
                gestureDirection: 'horizontal',
            }}
        >
            <MessagesStack.Screen name="MessagesIndex" component={MessagesScreen} />
            <MessagesStack.Screen
                name="NewMessage"
                component={NewMessageScreen}
                options={{
                    animation: 'slide_from_bottom',
                    presentation: 'modal',
                    gestureEnabled: true,
                    fullScreenGestureEnabled: true,
                }}
            />
        </MessagesStack.Navigator>
    );
}

function MainTabs() {
    return (
        <Tab.Navigator
            tabBar={(props: any) => <LiquidGlassTabBar {...props} />}
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: 'transparent',
                    borderTopWidth: 0,
                    position: 'absolute',
                    elevation: 0,
                },
            }}
            sceneContainerStyle={{
                backgroundColor: 'transparent',
            }}
        >
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Search" component={SearchStackNavigator} />
            <Tab.Screen name="Messages" component={MessagesStackNavigator} />
            <Tab.Screen name="Profile" component={ProfileStackNavigator} />
        </Tab.Navigator>
    );
}

export default function AppNavigator() {
    // Use isLoading from AuthContext to wait for session restore
    const { isAuthenticated, isLoading } = useAuth();

    // Show loading screen while restoring session from storage
    if (isLoading) {
        return <LoadingScreen />;
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <NavigationContainer>
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                    {!isAuthenticated ? (
                        // Auth Stack
                        <Stack.Group>
                            <Stack.Screen name="Login" component={LoginScreen} />
                            <Stack.Screen name="SignUp" component={SignUpScreen} />
                        </Stack.Group>
                    ) : (
                        // App Stack (Authenticated)
                        <Stack.Screen name="App" component={AuthenticatedStack} />
                    )}
                </Stack.Navigator>
            </NavigationContainer>
        </GestureHandlerRootView>
    );
}

function AuthenticatedStack() {
    const { user } = useAuth();
    // Check if onboarding needed (temp username starts with user_)
    const needsOnboarding = user?.username?.startsWith('user_');

    return (
        <Stack.Navigator
            screenOptions={{ headerShown: false }}
            // If needsOnboarding detected, Force start at Username. Else Main.
            initialRouteName={needsOnboarding ? "Username" : "Main"}
        >
            <Stack.Screen name="Main" component={MainTabs} />

            {/* Onboarding Flow */}
            <Stack.Screen name="Username" component={UsernameScreen} />
            <Stack.Screen name="Pseudo" component={PseudoScreen} />
            <Stack.Screen name="Bio" component={BioScreen} />
            <Stack.Screen name="Avatar" component={AvatarScreen} />

            {/* Other Screens */}
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="Chat" component={ChatScreen} options={{ animation: 'slide_from_right', animationDuration: 280, gestureEnabled: true }} />
            <Stack.Screen name="ConversationSettings" component={ConversationSettingsScreen} options={{ animation: 'slide_from_right', animationDuration: 280, gestureEnabled: true }} />
            <Stack.Screen name="UserProfile" component={ProfileScreen} />
            <Stack.Screen name="MessageRequests" component={MessageRequestsScreen} options={{ animation: 'slide_from_right', animationDuration: 280, gestureEnabled: true }} />
        </Stack.Navigator>
    );
}
