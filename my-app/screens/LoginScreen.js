import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { forgotPassword } from '../backend/authService';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing Information', 'Please enter both your email and password to continue.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Navigation will happen automatically due to auth state change in App.js
    } catch (error) {
      // Suppress console errors to prevent them from showing in development
      // console.error('Login error:', error);
      
      // User-friendly error messages
      let title = 'Login Failed';
      let message = '';
      
      switch (error.code) {
        case 'auth/user-not-found':
          title = 'Account Not Found';
          message = 'No account exists with this email address. Please check your email or create a new account.';
          break;
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
        case 'auth/invalid-login-credentials':
          title = 'Incorrect Credentials';
          message = 'The email or password you entered is incorrect. Please try again.';
          break;
        case 'auth/invalid-email':
          title = 'Invalid Email';
          message = 'Please enter a valid email address.';
          break;
        case 'auth/user-disabled':
          title = 'Account Disabled';
          message = 'Your account has been disabled. Please contact support for assistance.';
          break;
        case 'auth/too-many-requests':
          title = 'Too Many Attempts';
          message = 'Too many failed login attempts. Please wait a few minutes before trying again, or reset your password.';
          break;
        case 'auth/network-request-failed':
          title = 'Connection Error';
          message = 'Unable to connect to the server. Please check your internet connection and try again.';
          break;
        case 'auth/configuration-not-found':
          title = 'Service Unavailable';
          message = 'The login service is currently unavailable. Please try again later or contact support.';
          break;
        case 'auth/weak-password':
          title = 'Weak Password';
          message = 'Your password is too weak. Please choose a stronger password.';
          break;
        case 'auth/email-already-in-use':
          title = 'Email In Use';
          message = 'An account with this email already exists. Try logging in instead.';
          break;
        default:
          title = 'Login Error';
          message = 'Something went wrong while trying to log you in. Please try again.';
          break;
      }
      
      // Ensure the error is fully handled and doesn't propagate
      setTimeout(() => {
        Alert.alert(title, message);
      }, 100);
      
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    if (!email) {
      Alert.alert(
        'Enter Your Email', 
        'Please enter your email address first, then tap "Forgot Password?" to receive a reset link.'
      );
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address to receive the password reset link.');
      return;
    }

    Alert.alert(
      'Reset Your Password',
      `We'll send a password reset link to:\n\n${email}\n\nCheck your email and follow the instructions to create a new password.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Reset Link',
          onPress: async () => {
            try {
              setLoading(true);
              await forgotPassword(email);
              Alert.alert(
                'Reset Link Sent!', 
                'We\'ve sent a password reset link to your email. Please check your inbox (and spam folder) for instructions on how to reset your password.'
              );
            } catch (error) {
              // Suppress console errors in production
              // console.error('Forgot password error:', error);
              
              let message = 'Unable to send the password reset email. Please try again.';
              if (error.code === 'auth/user-not-found') {
                message = 'No account found with this email address. Please check your email or create a new account.';
              } else if (error.code === 'auth/invalid-email') {
                message = 'Please enter a valid email address.';
              } else if (error.code === 'auth/too-many-requests') {
                message = 'Too many reset attempts. Please wait a few minutes before trying again.';
              }
              
              setTimeout(() => {
                Alert.alert('Reset Failed', message);
              }, 100);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.loginText}>Log In to </Text>
              <Image 
                source={require('../assets/PeerHoo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.subtitle}>Connect • Study • Succeed</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.passwordToggle}
                disabled={loading}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[styles.loginButton, loading && styles.buttonDisabled]} 
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>Login</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.forgotPassword}
              onPress={handleForgotPassword}
              disabled={loading}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity 
              onPress={() => navigation.navigate('Signup')}
              disabled={loading}
            >
              <Text style={styles.signupLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 50,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  loginText: {
    fontSize: 32,
    fontWeight: '600',
    color: '#333',
  },
  logo: {
    width: 170,
    height: 85,
    marginLeft: 6,
    marginTop: -13,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  form: {
    marginBottom: 30,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 15,
    paddingHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: '#333',
  },
  passwordToggle: {
    padding: 5,
  },
  loginButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: '#999',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: 15,
  },
  forgotPasswordText: {
    color: '#FF6B35',
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: '#666',
    fontSize: 14,
  },
  signupLink: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default LoginScreen;