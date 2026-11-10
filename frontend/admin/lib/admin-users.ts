import { apiClient } from './api-client';

export async function getUsers(page = 1, limit = 100) {
  try {
    const data = await apiClient.getUsers({ skip: (page-1)*limit, limit });
    return data;
  } catch (error) {
    console.error('Error in getUsers:', error);
    throw error;
  }
}

export async function getUser(id: string) {
  try {
    return await apiClient.getUser(id);
  } catch (error) {
    console.error(`Error fetching user ${id}:`, error);
    throw error;
  }
}

export async function createUser(userData: any) {
  try {
    return await apiClient.createUser(userData);
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

export async function updateUser(id: string, userData: any) {
  try {
    return await apiClient.updateUser(id, userData);
  } catch (error) {
    console.error(`Error updating user ${id}:`, error);
    throw error;
  }
}

export async function deleteUser(id: string) {
  try {
    return await apiClient.deleteUser(id);
  } catch (error) {
    console.error(`Error deleting user ${id}:`, error);
    throw error;
  }
}