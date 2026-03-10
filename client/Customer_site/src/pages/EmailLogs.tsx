import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { apiGet } from '@/utils/api';

interface EmailLog {
  id: number;
  recipient_email: string;
  template_type: string;
  subject: string;
  status: 'pending' | 'sent' | 'failed' | 'bounced';
  error_message?: string;
  order_id?: string;
  product_name?: string;
  sent_at: string;
}

const EmailLogs: React.FC = () => {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchEmailLogs();
  }, []);

  const fetchEmailLogs = async () => {
    try {
      const response = await apiGet('/emails/logs/');

      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      } else {
        throw new Error('Failed to fetch email logs');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load email logs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'bounced':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Mail className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      sent: 'default',
      failed: 'destructive',
      bounced: 'secondary',
      pending: 'outline',
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatTemplateType = (type: string) => {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Email History</h1>
        <p className="text-gray-600">
          View all emails sent to your account. This includes order confirmations, updates, and notifications.
        </p>
      </div>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No emails found</h3>
            <p className="text-gray-500 text-center">
              You haven't received any emails yet. Emails will appear here once they're sent.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <Card key={log.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    {getStatusIcon(log.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="text-lg font-medium text-gray-900 truncate">
                          {log.subject}
                        </h3>
                        {getStatusBadge(log.status)}
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500 mb-2">
                        <span className="flex items-center">
                          <Mail className="h-4 w-4 mr-1" />
                          {formatTemplateType(log.template_type)}
                        </span>
                        <span>{formatDate(log.sent_at)}</span>
                      </div>

                      {(log.order_id || log.product_name) && (
                        <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                          {log.order_id && (
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md">
                              Order: {log.order_id}
                            </span>
                          )}
                          {log.product_name && (
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-md">
                              Product: {log.product_name}
                            </span>
                          )}
                        </div>
                      )}

                      {log.error_message && (
                        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                          <p className="text-sm text-red-700">
                            <strong>Error:</strong> {log.error_message}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmailLogs;