import React, { useState, useEffect } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { CustomTabBar } from "../components/CustomTabBar";
import LoadingScreen from "../screens/LoadingScreen";
import LoginScreen from "../screens/LoginScreen";
import SignUpScreen from "../screens/SignUpScreen";
import PseudoScreen from "../screens/PseudoScreen";
import BioScreen from "../screens/BioScreen";
import AvatarScreen from "../screens/AvatarScreen";
import SettingsScreen from "../screens/SettingsScreen";
import UserProfileScreen from "../screens/UserProfileScreen"; // Added import
import { useAuth } from "../lib/AuthContext";
import HomeScreen from "../screens/HomeScreen";
import SearchScreen from "../screens/SearchScreen";
import MessagesScreen from "../screens/MessagesScreen";
import ProfileScreen from "../screens/ProfileScreen";
import { theme } from "../theme";

import ChatScreen from "../screens/ChatScreen";
import NewMessageScreen from "../screens/NewMessageScreen";
import UserListScreen from "../screens/UserListScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const SearchStack = createNativeStackNavigator();
function SearchStackNavigator() {
    return (
        <SearchStack.Navigator screenOptions={{ headerShown: false }}>
            <SearchStack.Screen name="SearchIndex" component={SearchScreen} />
            <SearchStack.Screen name="UserProfile" component={UserProfileScreen} />
        </SearchStack.Navigator>
    );
}

const ProfileStack = createNativeStackNavigator();
function ProfileStackNavigator() {
    return (
        <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
            <ProfileStack.Screen name="ProfileIndex" component={ProfileScreen} />
            <ProfileStack.Screen name="UserList" component={UserListScreen} />
            <ProfileStack.Screen name="UserProfile" component={UserProfileScreen} />
        </ProfileStack.Navigator>
    );
}

const MessagesStack = createNativeStackNavigator();
function MessagesStackNavigator() {
    return (
        <MessagesStack.Navigator screenOptions={{ headerShown: false }}>
            <MessagesStack.Screen name="MessagesIndex" component={MessagesScreen} />
            <MessagesStack.Screen name="NewMessage" component={NewMessageScreen} />
        </MessagesStack.Navigator>
    );
}

function MainTabs() {
    return (
        <Tab.Navigator
            tabBar={(props: any) => <CustomTabBar {...props} />}
            screenOptions={{ headerShown: false }}
        >
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Search" component={SearchStackNavigator} />
            <Tab.Screen name="Messages" component={MessagesStackNavigator} />
            <Tab.Screen name="Profile" component={ProfileStackNavigator} />
        </Tab.Navigator>
    );
}

export default function AppNavigator() {
    // Simulate loading state (or use real auth check later)
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Fake splash delay
        setTimeout(() => {
            setIsLoading(false);
        }, 2000);
    }, []);

    if (isLoading) {
        return <LoadingScreen />;
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <NavigationContainer>
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                    {/* Auth Stack */}
                    <Stack.Screen name="Login" component={LoginScreen} />
                    <Stack.Screen name="SignUp" component={SignUpScreen} />
                    <Stack.Screen name="Pseudo" component={PseudoScreen} />
                    <Stack.Screen name="Bio" component={BioScreen} />
                    <Stack.Screen name="Avatar" component={AvatarScreen} />
                    <Stack.Screen name="Settings" component={SettingsScreen} options={{ animation: 'slide_from_bottom' }} />
                    <Stack.Screen name="Chat" component={ChatScreen} />
                    <Stack.Screen name="UserProfile" component={UserProfileScreen} />

                    {/* Main App */}
                    <Stack.Screen name="Main" component={MainTabs} />
                </Stack.Navigator>
            </NavigationContainer>
        </GestureHandlerRootView>
    );
}
